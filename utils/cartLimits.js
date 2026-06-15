export const MAX_CART_QUANTITY_PER_ITEM = 5;

export const normalizeCartQuantity = (quantity) => {
    const normalizedQuantity = Number.parseInt(quantity, 10);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity < 1) {
        throw new Error("Quantity must be at least 1.");
    }
    if (normalizedQuantity > MAX_CART_QUANTITY_PER_ITEM) {
        throw new Error(`Maximum quantity limit of ${MAX_CART_QUANTITY_PER_ITEM} reached for this item.`);
    }
    return normalizedQuantity;
};
