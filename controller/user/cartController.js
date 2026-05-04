import * as cartService from "../../service/user/cartService.js";

const getCartData = async (userId) => {
    const cart = await cartService.getCart(userId);
    let cartTotal = 0;
    let cartItems = [];

    if (cart && cart.items.length > 0) {
        cartItems = cart.items.map(item => {
            const product = item.product;
            let price = product.price;
            let stock = 0;

            if (item.variant && product.variants && product.variants.length > 0) {
                const variantData = product.variants.find(v => v.name === item.variant);
                if (variantData) {
                    if (variantData.priceOverride) price = variantData.priceOverride;
                    stock = variantData.stock;
                }
            } else if (product.variants && product.variants.length > 0) {
                // Should not happen if cart validation is working, but safety first
                stock = 0;
            } else {
                // Product has no variants
                stock = 0;
            }
            
            const itemTotal = price * item.quantity;
            cartTotal += itemTotal;

            return {
                productId: product._id,
                productName: product.name,
                brand: product.brand,
                author: product.author,
                category: product.category,
                coverImage: product.coverImage || (product.images.length > 0 ? product.images[0] : ''),
                variant: item.variant,
                quantity: item.quantity,
                price: price,
                itemTotal: itemTotal,
                stock: stock,
                isBlocked: product.isBlocked,
                isDeleted: product.isDeleted
            };
        });
    }
    return { cartItems, cartTotal };
};

export const getCartPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const { cartItems, cartTotal } = await getCartData(userId);

        res.render("pages/cart", {
            title: "Shopping Cart | GRANTHAE.",
            user: req.user,
            cartItems,
            cartTotal
        });
    } catch (error) {
        console.error("Get Cart Page error:", error);
        res.status(500).render("pages/error", { title: "Error", message: "Could not load cart." });
    }
};

export const addToCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variant, quantity } = req.body;

        await cartService.addToCart(userId, productId, variant, quantity);
        res.status(200).json({ success: true, message: "Added to cart successfully." });
    } catch (error) {
        console.error("Add to cart error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

export const updateQuantity = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variant, action } = req.body;

        await cartService.updateCartQuantity(userId, productId, variant, action);
        const { cartTotal } = await getCartData(userId);
        
        // Find the updated item to return its individual total
        const cart = await cartService.getCart(userId);
        const item = cart.items.find(i => i.product._id.toString() === productId && i.variant === variant);
        
        let itemPrice = item.product.price;
        if (item.variant && item.product.variants) {
             const v = item.product.variants.find(v => v.name === item.variant);
             if (v && v.priceOverride) itemPrice = v.priceOverride;
        }

        res.status(200).json({ 
            success: true, 
            quantity: item.quantity,
            itemTotal: itemPrice * item.quantity,
            cartTotal,
            message: "Quantity updated." 
        });
    } catch (error) {
        console.error("Update quantity error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

export const removeFromCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const { productId, variant } = req.body;

        await cartService.removeFromCart(userId, productId, variant);
        res.status(200).json({ success: true, message: "Item removed from cart." });
    } catch (error) {
        console.error("Remove from cart error:", error);
        res.status(500).json({ success: false, message: "Failed to remove item." });
    }
};
