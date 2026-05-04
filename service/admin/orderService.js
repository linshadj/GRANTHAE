import orderDb from "../../models/orderDb.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const orderDetails = async (page = 1, search = "", sort = "newest", filter = "all", userId = null) => {
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = {};

    // Filter by specific user if provided
    if (userId) {
        query.user = userId;
    }

    // Search by orderID or user name (needs population)
    const normalizedSearch = search.trim();
    if (normalizedSearch) {
        const searchPattern = escapeRegex(normalizedSearch).replace(/\s+/g, "\\s+");

        query.$or = [
            { orderID: { $regex: searchPattern, $options: "i" } },
            { "shippingAddress.firstName": { $regex: searchPattern, $options: "i" } },
            { "shippingAddress.lastName": { $regex: searchPattern, $options: "i" } },
            {
                $expr: {
                    $regexMatch: {
                        input: {
                            $concat: [
                                { $ifNull: ["$shippingAddress.firstName", ""] },
                                " ",
                                { $ifNull: ["$shippingAddress.lastName", ""] }
                            ]
                        },
                        regex: searchPattern,
                        options: "i"
                    }
                }
            }
        ];
    }

    // Filter by status
    if (filter !== "all") {
        query.orderStatus = filter;
    }

    // Sorting
    let sortCriteria = { createdAt: -1 };
    if (sort === "oldest") sortCriteria = { createdAt: 1 };
    else if (sort === "newest") sortCriteria = { createdAt: -1 };

    const totalOrders = await orderDb.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await orderDb.find(query)
        .populate('user', 'firstName lastName email')
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit);

    return {
        orders,
        totalPages,
        currentPage: page,
        totalOrders
    };
};

export const getOrderById = async (orderId) => {
    return await orderDb.findById(orderId)
        .populate('user', 'firstName lastName email')
        .populate('items.product');
};

export const updateOrderStatusService = async (orderId, status) => {
    const validStatuses = ['Pending', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
        throw new Error("Invalid status");
    }

    const order = await orderDb.findById(orderId);
    if (!order) {
        throw new Error("Order not found");
    }

    const statusOrder = {
        'Pending': 1,
        'Shipped': 2,
        'Out for delivery': 3,
        'Delivered': 4,
        'Cancelled': 5
    };

    if (order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled') {
        throw new Error(`Order is already ${order.orderStatus} and cannot be modified.`);
    }

    if (status !== 'Cancelled' && statusOrder[status] <= statusOrder[order.orderStatus]) {
        throw new Error(`Cannot move order status backward from ${order.orderStatus} to ${status}.`);
    }

    // If changing to Cancelled
    if (status === 'Cancelled' && order.orderStatus !== 'Cancelled') {
        const { Product } = await import("../../models/productDb.js");
        for (let item of order.items) {
            if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
                item.itemStatus = 'Cancelled';
                item.cancellationReason = 'Cancelled by Admin';

                if (item.variant) {
                    await Product.updateOne(
                        { _id: item.product, "variants.name": item.variant },
                        { $inc: { "variants.$.stock": item.quantity } }
                    );
                } else {
                    await Product.updateOne(
                        { _id: item.product },
                        { $inc: { stock: item.quantity } }
                    );
                }
            }
        }
    } 
    // If changing to Delivered or other statuses
    else if (status !== order.orderStatus) {
        for (let item of order.items) {
            if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
                item.itemStatus = status;
            }
        }
    }

    order.orderStatus = status;
    await order.save();
    return order;
};
