import {
    buildSalesReportExcel,
    buildSalesReportPdf,
    getSalesReportData,
} from "../../service/admin/reportService.js";

export const reportsPage = async (req, res, next) => {
    try {
        const report = await getSalesReportData(req.query);
        res.render("admin/reports", {
            layout: "layouts/admin-panel",
            title: "Sales Reports",
            subtitle: "Filter sales, discounts, coupon deductions, and export reports.",
            path: "/admin/reports",
            report,
            filters: {
                period: report.period,
                startDate: report.startDate,
                endDate: report.endDate,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const downloadSalesReport = async (req, res, next) => {
    try {
        const format = req.params.format;
        const filenameDate = new Date().toISOString().slice(0, 10);

        if (format === "pdf") {
            const pdfBuffer = await buildSalesReportPdf(req.query);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=Sales-Report-${filenameDate}.pdf`);
            return res.send(pdfBuffer);
        }

        if (format === "excel") {
            const workbook = await buildSalesReportExcel(req.query);
            res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename=Sales-Report-${filenameDate}.xls`);
            return res.send(workbook);
        }

        return res.status(400).send("Unsupported report format.");
    } catch (error) {
        next(error);
    }
};
