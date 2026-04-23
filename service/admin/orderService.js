import orderDb from "../../models/orderDb.js";

export const orderDetails = async (page = 1, search = "", sort = "newest", filter = "all") => {
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = {};

    // Search by orderID or user name (needs population)
    if (search) {
        query.$or = [
            { orderID: { $regex: search, $options: "i" } },
            { "shippingAddress.firstName": { $regex: search, $options: "i" } },
            { "shippingAddress.lastName": { $regex: search, $options: "i" } }
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

    const order = await orderDb.findByIdAndUpdate(orderId, { orderStatus: status }, { new: true });
    if (!order) {
        throw new Error("Order not found");
    }
    return order;
};
