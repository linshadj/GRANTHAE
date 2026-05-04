import * as orderService from "../../service/user/orderService.js";

export const listOrdersPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const searchQuery = req.query.search || '';
        
        const orders = await orderService.getUserOrders(userId, searchQuery);

        res.render("pages/orders", {
            title: "My Orders | GRANTHAE",
            layout: "layouts/user-panel",
            user: req.user,
            orders,
            searchQuery,
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
        res.status(400).json({ success: false, message: error.message });
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
        res.status(400).json({ success: false, message: error.message });
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
        res.status(500).send(error.message);
    }
};
