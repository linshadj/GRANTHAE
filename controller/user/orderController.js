import * as orderService from "../../service/user/orderService.js";
import * as rentalService from "../../service/user/rentalService.js";
import { getFriendlyErrorMessage } from "../../utils/friendlyError.js";

export const listOrdersPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const orderType = req.query.type === "rents" ? "rents" : "purchases";
        const filters = {
            search: req.query.search || "",
            status: req.query.status || "all",
            startDate: req.query.startDate || "",
            endDate: req.query.endDate || "",
            sort: req.query.sort || "newest",
            page: req.query.page || 1,
            limit: 8
        };
        
        const [purchaseResult, rentalResult] = orderType === "rents"
            ? [
                { orders: [], total: 0, totalPages: 1, currentPage: 1, limit: filters.limit },
                await rentalService.getRenterOrdersForOrdersPage(userId, filters)
            ]
            : [
                await orderService.getUserOrders(userId, filters),
                { rentalOrders: [], total: 0, totalPages: 1, currentPage: 1, limit: filters.limit }
            ];

        res.render("pages/orders", {
            title: "My Orders | GRANTHAE",
            layout: "layouts/user-panel",
            user: req.user,
            orderType,
            orders: purchaseResult.orders,
            rentalOrders: rentalResult.rentalOrders,
            pagination: orderType === "rents" ? rentalResult : purchaseResult,
            searchQuery: filters.search,
            filters,
            path: '/profile/orders'
        });
    } catch (error) {
        console.error("List Orders Page Error:", error);
        res.status(500).render("pages/error", { title: "Error", message: "Failed to load orders." });
    }
};

export const orderDetailsPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;

        const order = await orderService.getOrderById(userId, orderId);

        res.render("pages/order-details", {
            title: `Order ${order.orderID} | GRANTHAE`,
            layout: "layouts/user-panel",
            user: req.user,
            order,
            path: '/profile/orders'
        });
    } catch (error) {
        console.error("Order Details Error:", error);
        res.status(404).render("pages/error", { title: "Error", message: "Order not found." });
    }
};

export const cancelProduct = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId, itemId, reason } = req.body;

        await orderService.cancelOrderItem(userId, orderId, itemId, reason);
        
        res.status(200).json({ success: true, message: "Item cancelled successfully." });
    } catch (error) {
        console.error("Cancel Product Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not cancel this item.") });
    }
};

export const returnProduct = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId, itemId, reason } = req.body;

        await orderService.returnOrderItem(userId, orderId, itemId, reason);

        res.status(200).json({ success: true, message: "Return request submitted successfully." });
    } catch (error) {
        console.error("Return Product Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not submit return request.") });
    }
};

export const downloadInvoice = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;

        const pdfBuffer = await orderService.generateInvoicePDF(userId, orderId);
        
        const order = await orderService.getOrderById(userId, orderId);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderID}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Invoice generation error:", error);
        res.status(500).send(getFriendlyErrorMessage(error, "Could not generate the invoice."));
    }
};
