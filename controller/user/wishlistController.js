import * as wishlistService from "../../service/user/wishlistService.js";

export const getWishlistPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const wishlist = await wishlistService.getWishlist(userId);

        const wishlistItems = wishlist.items.map(item => {
            const product = item.product;
            let price = product.price;
            let stock = 0;
            const hasVariants = product.variants && product.variants.length > 0;
            const needsVariantSelection = hasVariants && !item.variant;

            // Handle variants if requested
            if (item.variant && hasVariants) {
                const variantData = product.variants.find(v => v.name === item.variant);
                if (variantData) {
                    if (variantData.priceOverride) price = variantData.priceOverride;
                    stock = variantData.stock;
                }
            } else if (hasVariants) {
                // If no specific variant is in wishlist, show total stock of all variants
                stock = product.variants.reduce((acc, v) => acc + v.stock, 0);
            } else {
                stock = product.stock || 0;
            }


            return {
                productId: product._id,
                productName: product.name,
                author: product.author,
                brand: product.brand,
                coverImage: product.coverImage || (product.images.length > 0 ? product.images[0] : ''),
                variant: item.variant,
                price: price,
                stock: stock,
                hasVariants,
                needsVariantSelection,
                isBlocked: product.isBlocked,
                isDeleted: product.isDeleted
            };
        });

        res.render("pages/wishlist", {
            title: "My Wishlist | GRANTHAE.",
            user: req.user,
            wishlistItems
        });
    } catch (error) {
        console.error("Get Wishlist Page Error:", error);
        res.status(500).render("pages/error", { title: "Error", message: "Failed to load your wishlist." });
    }
};

export const addToWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variant } = req.body;

        const result = await wishlistService.addToWishlist(userId, productId, variant);
        const message = result.action === 'added' ? "Added to wishlist." : "Removed from wishlist.";
        
        res.status(200).json({ 
            success: true, 
            message: message,
            action: result.action 
        });
    } catch (error) {
        console.error("Add to wishlist error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variant } = req.body;

        await wishlistService.removeFromWishlist(userId, productId, variant);
        res.status(200).json({ success: true, message: "Removed from wishlist." });
    } catch (error) {
        console.error("Remove from wishlist error:", error);
        res.status(500).json({ success: false, message: "Failed to remove item." });
    }
};
