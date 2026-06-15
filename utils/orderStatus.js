const FINAL_ITEM_STATUSES = new Set(["Cancelled", "Returned"]);

export const syncFinalOrderStatus = (order) => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        return order?.orderStatus;
    }

    const allItemsFinal = order.items.every((item) => FINAL_ITEM_STATUSES.has(item.itemStatus));
    if (!allItemsFinal) return order.orderStatus;

    const hasReturnedItems = order.items.some((item) => item.itemStatus === "Returned");
    order.orderStatus = hasReturnedItems ? "Returned" : "Cancelled";
    return order.orderStatus;
};

export const getInvoiceOrderStatus = (order) => {
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
        return order?.orderStatus || "";
    }

    const allItemsFinal = order.items.every((item) => FINAL_ITEM_STATUSES.has(item.itemStatus));
    if (!allItemsFinal) return order.orderStatus;

    const hasReturnedItems = order.items.some((item) => item.itemStatus === "Returned");
    return hasReturnedItems ? "Returned" : "Cancelled";
};
