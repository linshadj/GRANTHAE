import orderDb from "../models/orderDb.js";
import { Rental } from "../models/rentalDb.js";
import mongoose from "mongoose";


export const adminNotificationMiddleware = async (req, res, next) => {
    res.locals.adminNotifications = { orders: 0, requests: 0, rentals: 0 };

    if (!req.path.startsWith("/admin") || req.path.startsWith("/admin/login") || !req.session?.isAdmin) {
        return next();
    }

    if (mongoose.connection.readyState !== 1) {
        return next();
    }

    try {
        const [pendingOrdersCount, returnRequestsOrders, pendingRentalsCount] = await Promise.all([
            orderDb.countDocuments({ orderStatus: "Pending" }),
            orderDb.countDocuments({
                items: { $elemMatch: { itemStatus: "Return Requested", returnRequestStatus: "Pending" } }
            }),
            Rental.countDocuments({ status: "Pending" })
        ]);

        res.locals.adminNotifications = {
            orders: pendingOrdersCount,
            requests: returnRequestsOrders,
            rentals: pendingRentalsCount
        };
    } catch (error) {
        console.error("Error fetching admin notifications:", error.message);
    }

    next();
};
