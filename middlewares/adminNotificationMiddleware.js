import orderDb from "../models/orderDb.js";
import { Rental } from "../models/rentalDb.js";


export const adminNotificationMiddleware = async (req, res, next) => {
    // Only fetch for admin routes
    if (req.path.startsWith('/admin')) {
        try {
            // Count pending orders
            const pendingOrdersCount = await orderDb.countDocuments({ orderStatus: 'Pending' });
            
            const returnRequestsOrders = await orderDb.countDocuments({
                items: { $elemMatch: { itemStatus: "Return Requested", returnRequestStatus: "Pending" } }
            });

            // Count pending rental requests
            const pendingRentalsCount = await Rental.countDocuments({ status: 'Pending' });
 
            res.locals.adminNotifications = {
                orders: pendingOrdersCount,
                requests: returnRequestsOrders,
                rentals: pendingRentalsCount
            };

        } catch (error) {
            console.error("Error fetching admin notifications:", error);
            res.locals.adminNotifications = { orders: 0, requests: 0, rentals: 0 };
        }
    }
    next();
};
