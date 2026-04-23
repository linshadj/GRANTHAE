import { orderDetails, getOrderById, updateOrderStatusService } from "../../service/admin/orderService.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

export const ordersPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || "";
        const sort = req.query.sort || "newest";
        const filter = req.query.filter || "all";

        const orderData = await orderDetails(page, search, sort, filter);

        res.render("admin/orders", {
            layout: "layouts/admin-panel",
            title: "Order Management",
            orders: orderData.orders,
            currentPage: orderData.currentPage,
            totalPages: orderData.totalPages,
            totalOrders: orderData.totalOrders,
            searchQuery: search,
            selectedSort: sort,
            selectedFilter: filter,
            path: "/admin/orders"
        });
    } catch (error) {
        next(error);
    }
};

export const viewOrderDetail = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await getOrderById(id);
        
        if (!order) {
            return res.redirect("/admin/orders");
        }

        res.render("admin/order-details", {
            layout: "layouts/admin-panel",
            title: "Order Details",
            order,
            path: "/admin/orders"
        });
    } catch (error) {
        next(error);
    }
};

export const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await updateOrderStatusService(id, status);

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: `Order status updated to ${status}`
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};

export const liveOrdersSearch = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const sort = req.query.sort || "newest";
        const filter = req.query.filter || "all";

        const orderData = await orderDetails(1, search, sort, filter);

        res.json({
            success: true,
            orders: orderData.orders
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};
