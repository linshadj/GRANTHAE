import orderDb from "../../models/orderDb.js";
import { Product } from "../../models/productDb.js";
import { creditWallet } from "../user/walletService.js";
import { safeWhitespaceRegex } from "../../utils/search.js";
import { syncOrderStatusFromItems } from "../../utils/orderStatus.js";

const roundCurrency = (amount) => Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

const isPaidOrder = (order) => order.paymentStatus === 'Success' || order.paymentMethod === 'Wallet';
const ITEM_STATUS_ORDER = {
    Pending: 1,
    Shipped: 2,
    "Out for delivery": 3,
    Delivered: 4,
};
const ADMIN_ITEM_STATUSES = new Set([...Object.keys(ITEM_STATUS_ORDER), "Cancelled"]);
const FINAL_ITEM_STATUSES = new Set(["Cancelled", "Returned"]);

const getActiveItemsSubtotal = (order) => {
    return roundCurrency(order.items.reduce((total, item) => {
        if (item.itemStatus === 'Cancelled' || item.itemStatus === 'Returned') return total;
        return total + (Number(item.price || 0) * Number(item.quantity || 0));
    }, 0));
};

const calculateItemRefundAmount = (order, item) => {
    const itemAmount = roundCurrency(Number(item.price || 0) * Number(item.quantity || 0));
    const activeSubtotal = getActiveItemsSubtotal(order);

    if (activeSubtotal <= 0) return 0;
    return roundCurrency(Math.min(itemAmount, Number(order.totalAmount || 0) * (itemAmount / activeSubtotal)));
};

const applyFinancialAdjustment = (order, item, refundAmount, trackRefund = true) => {
    const itemAmount = Number(item.price || 0) * Number(item.quantity || 0);
    order.subtotalAmount = Math.max(0, roundCurrency(Number(order.subtotalAmount || 0) - itemAmount));
    order.totalAmount = Math.max(0, roundCurrency(Number(order.totalAmount || 0) - refundAmount));
    if (trackRefund) {
        order.refundedAmount = roundCurrency(Number(order.refundedAmount || 0) + refundAmount);
    }
};

const incrementItemStock = async (item) => {
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
};

const refundCancelledItem = async (order, item, refundAmount) => {
    if (isPaidOrder(order) && item.refundStatus !== 'Completed' && refundAmount > 0) {
        await creditWallet(
            order.user,
            refundAmount,
            `Cancellation refund for order ${order.orderID}`,
            "order_refund",
            `${order._id}:${item._id}`
        );
        item.refundAmount = refundAmount;
        item.refundStatus = 'Completed';
        item.refundedAt = new Date();
    } else {
        item.refundAmount = 0;
        item.refundStatus = 'None';
    }

    applyFinancialAdjustment(order, item, refundAmount, isPaidOrder(order));
};

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
        const searchPattern = safeWhitespaceRegex(normalizedSearch);

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
        if (filter === "Failed") {
            query.paymentStatus = "Failed";
        } else if (filter === "Return Requested") {
            query.items = { $elemMatch: { itemStatus: "Return Requested", returnRequestStatus: "Pending" } };
        } else {
            query.orderStatus = filter;
        }
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

    if (order.orderStatus === 'Delivered' || order.orderStatus === 'Cancelled' || order.orderStatus === 'Returned') {
        throw new Error(`Order is already ${order.orderStatus} and cannot be modified.`);
    }

    if ((order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Online') && order.paymentStatus !== 'Success' && status !== 'Cancelled') {
        throw new Error("Online payment must be completed before progressing this order.");
    }

    if (status !== 'Cancelled' && statusOrder[status] <= statusOrder[order.orderStatus]) {
        throw new Error(`Cannot move order status backward from ${order.orderStatus} to ${status}.`);
    }

    // If changing to Cancelled
    if (status === 'Cancelled' && order.orderStatus !== 'Cancelled') {
        for (let item of order.items) {
            if (item.itemStatus !== 'Cancelled' && item.itemStatus !== 'Returned') {
                const refundAmount = calculateItemRefundAmount(order, item);
                item.itemStatus = 'Cancelled';
                item.cancellationReason = 'Cancelled by Admin';

                if (order.stockAdjusted !== false) {
                    await incrementItemStock(item);
                }

                if (isPaidOrder(order) && item.refundStatus !== 'Completed' && refundAmount > 0) {
                    await creditWallet(
                        order.user,
                        refundAmount,
                        `Cancellation refund for order ${order.orderID}`,
                        "order_refund",
                        `${order._id}:${item._id}`
                    );
                    item.refundAmount = refundAmount;
                    item.refundStatus = 'Completed';
                    item.refundedAt = new Date();
                } else {
                    item.refundAmount = 0;
                    item.refundStatus = 'None';
                }

                applyFinancialAdjustment(order, item, refundAmount, isPaidOrder(order));
            }
        }

        if (isPaidOrder(order) && order.totalAmount === 0) {
            order.paymentStatus = 'Refunded';
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
    if (status === 'Delivered' && order.paymentMethod === 'COD' && order.paymentStatus === 'Pending') {
        order.paymentStatus = 'Success';
        order.paidAt = new Date();
    }
    syncOrderStatusFromItems(order);
    await order.save();
    return order;
};

export const updateOrderItemStatusService = async (orderId, itemId, status, cancellationReason = "") => {
    if (!ADMIN_ITEM_STATUSES.has(status)) {
        throw new Error("Invalid item status.");
    }

    const order = await orderDb.findById(orderId);
    if (!order) {
        throw new Error("Order not found");
    }

    const item = order.items.id(itemId);
    if (!item) {
        throw new Error("Item not found in order");
    }

    if (FINAL_ITEM_STATUSES.has(item.itemStatus)) {
        throw new Error(`Item is already ${item.itemStatus} and cannot be modified.`);
    }

    if (item.itemStatus === "Return Requested") {
        throw new Error("Review the pending return request before changing this item.");
    }

    if (item.itemStatus === status) {
        throw new Error(`Item is already ${status}.`);
    }

    if ((order.paymentMethod === 'Razorpay' || order.paymentMethod === 'Online') && order.paymentStatus !== 'Success' && status !== 'Cancelled') {
        throw new Error("Online payment must be completed before progressing this item.");
    }

    if (status !== "Cancelled") {
        const currentLevel = ITEM_STATUS_ORDER[item.itemStatus] || ITEM_STATUS_ORDER.Pending;
        const nextLevel = ITEM_STATUS_ORDER[status];

        if (!nextLevel || nextLevel <= currentLevel) {
            throw new Error(`Cannot move item status backward from ${item.itemStatus} to ${status}.`);
        }

        item.itemStatus = status;
    } else {
        if (item.itemStatus === "Delivered") {
            throw new Error("Delivered items must be handled through the return flow.");
        }

        const refundAmount = calculateItemRefundAmount(order, item);
        item.itemStatus = "Cancelled";
        item.cancellationReason = String(cancellationReason || "").trim() || "Cancelled by Admin";

        if (order.stockAdjusted !== false) {
            await incrementItemStock(item);
        }

        await refundCancelledItem(order, item, refundAmount);
    }

    const derivedStatus = syncOrderStatusFromItems(order);
    if (derivedStatus === "Delivered" && order.paymentMethod === "COD" && order.paymentStatus === "Pending") {
        order.paymentStatus = "Success";
        order.paidAt = new Date();
    }
    if ((derivedStatus === "Returned" || derivedStatus === "Cancelled") && Number(order.totalAmount || 0) <= 0 && isPaidOrder(order)) {
        order.paymentStatus = "Refunded";
    }

    await order.save();
    return order;
};

export const reviewReturnRequestService = async (orderId, itemId, action, rejectionReason = "") => {
    const order = await orderDb.findById(orderId);
    if (!order) throw new Error("Order not found");

    const item = order.items.id(itemId);
    if (!item) throw new Error("Item not found in order");
    if (item.itemStatus !== 'Return Requested' || item.returnRequestStatus !== 'Pending') {
        throw new Error("This item does not have a pending return request.");
    }

    if (action === 'reject') {
        const reason = String(rejectionReason || "").trim();
        if (!reason) throw new Error("Rejection reason is required.");

        item.itemStatus = 'Delivered';
        item.returnRequestStatus = 'Rejected';
        item.returnRejectionReason = reason;
        item.returnReviewedAt = new Date();
        item.refundStatus = 'None';
        syncOrderStatusFromItems(order);
        await order.save();
        return order;
    }

    if (action !== 'approve') {
        throw new Error("Invalid return review action.");
    }

    const refundAmount = calculateItemRefundAmount(order, item);

    item.itemStatus = 'Returned';
    item.returnRequestStatus = 'Approved';
    item.returnReviewedAt = new Date();

    if (order.stockAdjusted !== false) {
        await incrementItemStock(item);
    }

    if (isPaidOrder(order) && item.refundStatus !== 'Completed' && refundAmount > 0) {
        await creditWallet(
            order.user,
            refundAmount,
            `Return refund for order ${order.orderID}`,
            "order_refund",
            `${order._id}:${item._id}`
        );
        item.refundAmount = refundAmount;
        item.refundStatus = 'Completed';
        item.refundedAt = new Date();
    } else {
        item.refundAmount = 0;
        item.refundStatus = 'None';
    }

    applyFinancialAdjustment(order, item, refundAmount, isPaidOrder(order));

    const finalStatus = syncOrderStatusFromItems(order);
    if ((finalStatus === 'Returned' || finalStatus === 'Cancelled') && Number(order.totalAmount || 0) <= 0 && isPaidOrder(order)) {
        order.paymentStatus = 'Refunded';
    }

    await order.save();
    return order;
};
