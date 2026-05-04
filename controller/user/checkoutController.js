import * as checkoutService from "../../service/user/checkoutService.js";

export const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const checkoutData = await checkoutService.getCheckoutData(userId);

        res.render("pages/checkout", {
            title: "Checkout | GRANTHAE",
            user: req.user,
            ...checkoutData
        });
    } catch (error) {
        console.error("Get Checkout Page Error:", error);
        if (error.message === 'Cart is empty') {
            return res.redirect('/cart');
        }
        if (error.message.includes('no longer available') || error.message.includes('Insufficient stock') || error.message.includes('unavailable')) {
            // Can add flash message here if using express-flash
            return res.redirect('/cart');
        }
        res.status(500).render("pages/error", { title: "Error", message: error.message });
    }
};

export const placeOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId, paymentMethod } = req.body;

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Please select a shipping address." });
        }

        const newOrder = await checkoutService.placeOrder(userId, addressId, paymentMethod);

        res.status(200).json({ 
            success: true, 
            message: "Order placed successfully!",
            orderId: newOrder._id
        });
    } catch (error) {
        console.error("Place Order Error:", error);
        res.status(400).json({ success: false, message: error.message });
    }
};

export const orderSuccessPage = async (req, res) => {
    try {
        const { orderId } = req.params;
        res.render("pages/order-success", {
            title: "Order Successful | GRANTHAE",
            user: req.user,
            orderId
        });
    } catch (error) {
        res.redirect('/home');
    }
};
