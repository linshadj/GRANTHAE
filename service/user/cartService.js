import cartDb from "../../models/cartDb.js";
import wishlistDb from "../../models/wishlistDb.js";
import { Product } from "../../models/productDb.js";

const maxQuantityPerItem = 10;

export const getCart = async (userId) => {
    let cart = await cartDb.findOne({ user: userId }).populate('items.product');
    if (!cart) {
        cart = await cartDb.create({ user: userId, items: [] });
    }
    return cart;
};

export const addToCart = async (userId, productId, variant = "", quantity = 1) => {
    // Prevent adding blocked/unlisted/deleted products
    const product = await Product.findOne({ _id: productId, isBlocked: false, isDeleted: false });
    if (!product) {
        throw new Error("Product is unavailable or blocked.");
    }

    // Check stock validation using variants
    if (!variant && product.variants && product.variants.length > 0) {
        throw new Error("Please select a product option.");
    }

    let availableStock = 0;
    const productVariant = product.variants.find(v => v.name === variant);
    if (productVariant) {
        availableStock = productVariant.stock;
    } else if (product.variants && product.variants.length > 0) {
        throw new Error("Selected option is unavailable.");
    } else {
        // Product has no variants and no base stock anymore
        availableStock = 0;
    }
    
    if (availableStock < quantity) {
        throw new Error(`Only ${availableStock} items in stock.`);
    }

    let cart = await cartDb.findOne({ user: userId });
    if (!cart) {
        cart = await cartDb.create({ user: userId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId && item.variant === variant);

    if (itemIndex > -1) {
        // Increase the quantity if the product is already in the cart
        const newQuantity = cart.items[itemIndex].quantity + Number(quantity);
        if (newQuantity > maxQuantityPerItem) {
            throw new Error(`Maximum quantity limit of ${maxQuantityPerItem} reached for this item.`);
        }
        if (newQuantity > availableStock) {
            throw new Error(`Cannot add more than available stock (${availableStock}).`);
        }
        cart.items[itemIndex].quantity = newQuantity;
    } else {
        if (quantity > maxQuantityPerItem) {
             throw new Error(`Maximum quantity limit of ${maxQuantityPerItem} reached for this item.`);
        }
        cart.items.push({ product: productId, variant, quantity });
    }

    await cart.save();

    // Remove product from wishlist when added to cart
    await wishlistDb.updateOne(
        { user: userId },
        { $pull: { items: { product: productId, variant: variant } } }
    );

    return cart;
};

export const updateCartQuantity = async (userId, productId, variant = "", action) => {
    const cart = await cartDb.findOne({ user: userId });
    if (!cart) throw new Error("Cart not found");

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId && item.variant === variant);
    if (itemIndex === -1) throw new Error("Item not in cart");

    
    const product = await Product.findById(productId);
    if (!product || product.isBlocked || product.isDeleted) throw new Error("Product unavailable.");
    
    let availableStock = 0;
    const productVariant = product.variants.find(v => v.name === variant);
    if (productVariant) {
        availableStock = productVariant.stock;
    }

    let currentQty = cart.items[itemIndex].quantity;
    if (action === 'increment') {
        if (currentQty >= maxQuantityPerItem) throw new Error(`Maximum limit of ${maxQuantityPerItem} reached.`);
        if (currentQty >= availableStock) throw new Error(`Only ${availableStock} available in stock.`);
        cart.items[itemIndex].quantity += 1;
    } else if (action === 'decrement') {
        if (currentQty <= 1) {
             throw new Error("Quantity cannot be less than 1. Remove item instead.");
        }
        cart.items[itemIndex].quantity -= 1;
    }

    await cart.save();
    return cart.items[itemIndex];
};

export const removeFromCart = async (userId, productId, variant = "") => {
    return await cartDb.findOneAndUpdate(
        { user: userId },
        { $pull: { items: { product: productId, variant: variant } } },
        { new: true }
    );
};
