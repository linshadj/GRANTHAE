const FINAL_ITEM_STATUSES = new Set(["Cancelled", "Returned"]);
const ITEM_STATUS_PROGRESS = {
    Pending: 1,
    Shipped: 2,
    "Out for delivery": 3,
    Delivered: 4,
    "Return Requested": 4,
};

export const getOrderStatusFromItems = (order) => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        return order?.orderStatus;
    }

    const allItemsFinal = order.items.every((item) => FINAL_ITEM_STATUSES.has(item.itemStatus));
    if (allItemsFinal) {
        const hasReturnedItems = order.items.some((item) => item.itemStatus === "Returned");
        return hasReturnedItems ? "Returned" : "Cancelled";
    }

    const activeItems = order.items.filter((item) => !FINAL_ITEM_STATUSES.has(item.itemStatus));
    const slowestActiveItem = activeItems.reduce((slowest, item) => {
        const itemProgress = ITEM_STATUS_PROGRESS[item.itemStatus] || ITEM_STATUS_PROGRESS.Pending;
        const slowestProgress = ITEM_STATUS_PROGRESS[slowest.itemStatus] || ITEM_STATUS_PROGRESS.Pending;
        return itemProgress < slowestProgress ? item : slowest;
    }, activeItems[0]);

    return slowestActiveItem?.itemStatus === "Return Requested"
        ? "Delivered"
        : slowestActiveItem?.itemStatus || order.orderStatus;
};

export const syncOrderStatusFromItems = (order) => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        return order?.orderStatus;
    }

    order.orderStatus = getOrderStatusFromItems(order);
    return order.orderStatus;
};

export const syncFinalOrderStatus = syncOrderStatusFromItems;

export const getInvoiceOrderStatus = (order) => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        return order?.orderStatus || "";
    }

    return getOrderStatusFromItems(order);
};
