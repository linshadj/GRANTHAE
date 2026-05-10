import PDFDocument from "pdfkit";
import orderDb from "../../models/orderDb.js";
import "../../models/userDb.js";

const roundCurrency = (amount) => Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

const formatDateInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

const endOfDay = (date) => {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
};

const getDateRange = ({ period = "daily", startDate, endDate }) => {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);

    if (period === "weekly") {
        start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    } else if (period === "yearly") {
        start = startOfDay(new Date(now.getFullYear(), 0, 1));
        end = endOfDay(new Date(now.getFullYear(), 11, 31));
    } else if (period === "custom") {
        start = startDate ? startOfDay(new Date(startDate)) : start;
        end = endDate ? endOfDay(new Date(endDate)) : end;
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Select a valid date range.");
    }
    if (end < start) throw new Error("End date cannot be before start date.");

    return { start, end };
};

const getOrderSubtotal = (order) => {
    if (Number(order.subtotalAmount || 0) > 0) return Number(order.subtotalAmount || 0);
    return order.items.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 0), 0);
};

const getOfferDiscount = (order) => {
    return order.items.reduce((total, item) => {
        if (item.itemStatus === "Cancelled" || item.itemStatus === "Returned") return total;
        return total + Number(item.offerDiscountAmount || 0) * Number(item.quantity || 0);
    }, 0);
};

export const getSalesReportData = async (query = {}) => {
    const period = ["daily", "weekly", "yearly", "custom"].includes(query.period) ? query.period : "daily";
    const { start, end } = getDateRange({ period, startDate: query.startDate, endDate: query.endDate });

    const orders = await orderDb.find({
        createdAt: { $gte: start, $lte: end },
        paymentStatus: { $ne: "Failed" },
        orderStatus: { $ne: "Cancelled" },
    })
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 });

    const rows = orders.map((order) => {
        const subtotal = roundCurrency(getOrderSubtotal(order));
        const offerDiscount = roundCurrency(getOfferDiscount(order));
        const couponDiscount = roundCurrency(order.discountAmount || 0);
        const refundedAmount = roundCurrency(order.refundedAmount || 0);
        const totalAmount = roundCurrency(order.totalAmount || 0);
        const itemCount = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

        return {
            orderId: order.orderID,
            mongoId: order._id,
            date: order.createdAt,
            customerName: order.user ? `${order.user.firstName || ""} ${order.user.lastName || ""}`.trim() : `${order.shippingAddress.firstName || ""} ${order.shippingAddress.lastName || ""}`.trim(),
            itemCount,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            status: order.orderStatus,
            subtotal,
            offerDiscount,
            couponDiscount,
            refundedAmount,
            totalAmount,
        };
    });

    const summary = rows.reduce((totals, row) => {
        totals.salesCount += 1;
        totals.itemCount += row.itemCount;
        totals.orderAmount = roundCurrency(totals.orderAmount + row.subtotal);
        totals.offerDiscount = roundCurrency(totals.offerDiscount + row.offerDiscount);
        totals.couponDiscount = roundCurrency(totals.couponDiscount + row.couponDiscount);
        totals.totalDiscount = roundCurrency(totals.totalDiscount + row.offerDiscount + row.couponDiscount);
        totals.refundedAmount = roundCurrency(totals.refundedAmount + row.refundedAmount);
        totals.netSales = roundCurrency(totals.netSales + row.totalAmount);
        return totals;
    }, {
        salesCount: 0,
        itemCount: 0,
        orderAmount: 0,
        offerDiscount: 0,
        couponDiscount: 0,
        totalDiscount: 0,
        refundedAmount: 0,
        netSales: 0,
    });

    return {
        period,
        startDate: formatDateInput(start),
        endDate: formatDateInput(end),
        generatedAt: new Date(),
        summary,
        rows,
    };
};

export const buildSalesReportPdf = async (query = {}) => {
    const report = await getSalesReportData(query);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 42, size: "A4" });
            const buffers = [];

            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => resolve(Buffer.concat(buffers)));

            doc.fontSize(18).text("GRANTHAE Sales Report", { align: "center" });
            doc.moveDown(0.5);
            doc.fontSize(9).text(`${report.startDate} to ${report.endDate}`, { align: "center" });
            doc.moveDown();

            doc.fontSize(11).font("Helvetica-Bold").text(`Orders: ${report.summary.salesCount}`);
            doc.text(`Net Sales: Rs ${report.summary.netSales.toLocaleString("en-IN")}`);
            doc.text(`Order Amount: Rs ${report.summary.orderAmount.toLocaleString("en-IN")}`);
            doc.text(`Total Discounts: Rs ${report.summary.totalDiscount.toLocaleString("en-IN")}`);
            doc.text(`Coupon Deductions: Rs ${report.summary.couponDiscount.toLocaleString("en-IN")}`);
            doc.moveDown();

            doc.fontSize(9).font("Helvetica-Bold");
            const tableTop = doc.y;
            doc.text("Order", 42, tableTop, { width: 90 });
            doc.text("Date", 132, tableTop, { width: 70 });
            doc.text("Customer", 202, tableTop, { width: 120 });
            doc.text("Status", 322, tableTop, { width: 80 });
            doc.text("Discount", 402, tableTop, { width: 60, align: "right" });
            doc.text("Total", 462, tableTop, { width: 80, align: "right" });
            doc.moveTo(42, tableTop + 14).lineTo(552, tableTop + 14).stroke();
            doc.font("Helvetica");

            let y = tableTop + 22;
            report.rows.forEach((row) => {
                if (y > 760) {
                    doc.addPage();
                    y = 42;
                }
                doc.text(row.orderId, 42, y, { width: 90 });
                doc.text(new Date(row.date).toLocaleDateString("en-IN"), 132, y, { width: 70 });
                doc.text(row.customerName || "Customer", 202, y, { width: 120 });
                doc.text(row.status, 322, y, { width: 80 });
                doc.text(`Rs ${row.couponDiscount + row.offerDiscount}`, 402, y, { width: 60, align: "right" });
                doc.text(`Rs ${row.totalAmount}`, 462, y, { width: 80, align: "right" });
                y += 20;
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

export const buildSalesReportExcel = async (query = {}) => {
    const report = await getSalesReportData(query);
    const rows = report.rows.map((row) => `
        <tr>
            <td>${row.orderId}</td>
            <td>${new Date(row.date).toLocaleDateString("en-IN")}</td>
            <td>${row.customerName || "Customer"}</td>
            <td>${row.itemCount}</td>
            <td>${row.paymentMethod}</td>
            <td>${row.status}</td>
            <td>${row.subtotal}</td>
            <td>${row.offerDiscount}</td>
            <td>${row.couponDiscount}</td>
            <td>${row.refundedAmount}</td>
            <td>${row.totalAmount}</td>
        </tr>
    `).join("");

    return `<!doctype html>
    <html>
        <head><meta charset="utf-8"></head>
        <body>
            <table border="1">
                <caption>GRANTHAE Sales Report (${report.startDate} to ${report.endDate})</caption>
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Order Amount</th>
                        <th>Offer Discount</th>
                        <th>Coupon Deduction</th>
                        <th>Refunded</th>
                        <th>Net Sales</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </body>
    </html>`;
};
