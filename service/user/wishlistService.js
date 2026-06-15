import wishlistDb from "../../models/wishlistDb.js";
import { Product } from "../../models/productDb.js";

export const getWishlist = async (userId) => {
    let wishlist = await wishlistDb.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
    });
    
    if (!wishlist) {
        wishlist = await wishlistDb.create({ user: userId, items: [] });
    }

    return wishlist;
};

export const addToWishlist = async (userId, productId, variant = "") => {
    const product = await Product.findById(productId).populate('category');
    if (!product || product.isDeleted || product.isBlocked) {
        throw new Error("Product is no longer available.");
    }
    if (product.category && (product.category.isBlocked || product.category.isDeleted)) {
        throw new Error("Product category is disabled.");
    }

    let wishlist = await wishlistDb.findOne({ user: userId });
    
    if (!wishlist) {
        wishlist = await wishlistDb.create({ user: userId, items: [] });
    }

    // Check if it already exists
    const itemIndex = wishlist.items.findIndex(
        (item) => item.product.toString() === productId && item.variant === variant
    );

    if (itemIndex > -1) {
        // Toggle behavior: Remove if exists
        wishlist.items.splice(itemIndex, 1);
        await wishlist.save();
        return { action: 'removed', wishlist };
    }

    // Add if not exists
    wishlist.items.push({ product: productId, variant });
    await wishlist.save();

    return { action: 'added', wishlist };
};

export const removeFromWishlist = async (userId, productId, variant = "") => {
    const updatedWishlist = await wishlistDb.findOneAndUpdate(
        { user: userId },
        { $pull: { items: { product: productId, variant: variant } } },
        { new: true }
    );
    
    return updatedWishlist;
};
