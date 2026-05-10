import orderDb from "../../models/orderDb.js";
import userDb from "../../models/userDb.js";
import { Product } from "../../models/productDb.js";
import { Rental } from "../../models/rentalDb.js";

export const adminDashboardPage = async (req, res, next) => {
    try {
        const [
            totalUsers,
            activeRentals,
            totalProducts,
            pendingOrders,
            pendingReturnRequests,
            revenueAgg,
            recentOrders
        ] = await Promise.all([
            userDb.countDocuments({ role: "user" }),
            Rental.countDocuments({ isDeleted: false, status: { $in: ["Approved", "Available", "Rented"] } }),
            Product.countDocuments({ isDeleted: false }),
            orderDb.countDocuments({ orderStatus: "Pending" }),
            orderDb.countDocuments({
                items: { $elemMatch: { itemStatus: "Return Requested", returnRequestStatus: "Pending" } }
            }),
            orderDb.aggregate([
                { $match: { paymentStatus: { $ne: "Failed" }, orderStatus: { $ne: "Cancelled" } } },
                { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } }
            ]),
            orderDb.find({})
                .populate("user", "firstName lastName")
                .sort({ createdAt: -1 })
                .limit(5)
        ]);

        const dashboard = {
            totalUsers,
            activeRentals,
            totalProducts,
            pendingOrders,
            pendingReturnRequests,
            revenue: revenueAgg[0]?.revenue || 0,
            totalSalesOrders: revenueAgg[0]?.orders || 0,
            recentOrders,
        };

        res.render("admin/dashboard", {
            title: "Admin Dashboard",
            layout: "layouts/admin-panel",
            path: "/admin/dashboard",
            dashboard,
        });
    } catch (error) {
        next(error);
    }
};
