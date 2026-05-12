import * as checkoutService from "../../service/user/checkoutService.js";
import { createRazorpayOrder, getRazorpayKeyId, isRazorpayConfigured } from "../../service/user/razorpayService.js";
import { getWallet } from "../../service/user/walletService.js";
import { addNewAddressService } from "../../service/user/profileService.js";
import mongoose from "mongoose";
import orderDb from "../../models/orderDb.js";
import { getFriendlyErrorMessage } from "../../utils/friendlyError.js";

export const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.user._id;
        const [checkoutData, wallet] = await Promise.all([
            checkoutService.getCheckoutData(userId),
            getWallet(userId)
        ]);
        const availableCoupons = await checkoutService.getAvailableCouponsForCheckout(userId, checkoutData.cartTotal);
        let appliedCoupon = null;

        if (req.session.checkoutCoupon?.code) {
            try {
                appliedCoupon = await checkoutService.applyCouponToCheckout(userId, req.session.checkoutCoupon.code);
            } catch (couponError) {
                delete req.session.checkoutCoupon;
            }
        }

        res.render("pages/checkout", {
            title: "Checkout",
            user: req.user,
            appliedCoupon,
            availableCoupons,
            walletBalance: wallet.balance || 0,
            razorpayKeyId: getRazorpayKeyId(),
            razorpayConfigured: isRazorpayConfigured(),
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
        res.status(500).render("pages/error", { title: "Error", message: getFriendlyErrorMessage(error, "Could not load checkout. Please try again.") });
    }
};

export const placeOrder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { addressId, paymentMethod } = req.body;
        const requestedCouponCode = String(req.body.couponCode || "").trim().toUpperCase();
        const sessionCouponCode = req.session.checkoutCoupon?.code || "";

        if (!addressId) {
            return res.status(400).json({ success: false, message: "Please select a shipping address." });
        }

        if (sessionCouponCode && requestedCouponCode && requestedCouponCode !== sessionCouponCode) {
            return res.status(409).json({ success: false, message: "Remove the current coupon before applying another one." });
        }

        if (paymentMethod === "Razorpay" && !isRazorpayConfigured()) {
            return res.status(400).json({ success: false, message: "Razorpay keys are not configured." });
        }

        const couponCode = sessionCouponCode || requestedCouponCode;
        const newOrder = await checkoutService.placeOrder(userId, addressId, paymentMethod, couponCode);

        if (newOrder.paymentMethod === "Razorpay") {
            try {
                const razorpayOrder = await createRazorpayOrder({
                    amount: newOrder.totalAmount,
                    receipt: newOrder.orderID,
                    notes: {
                        orderId: newOrder.orderID,
                        internalOrderId: newOrder._id.toString()
                    }
                });

                await checkoutService.setRazorpayOrderReference(userId, newOrder._id, razorpayOrder.id);

                return res.status(200).json({
                    success: true,
                    message: "Razorpay payment initialized.",
                    paymentMethod: "Razorpay",
                    orderId: newOrder.orderID,
                    internalOrderId: newOrder._id,
                    razorpay: {
                        keyId: getRazorpayKeyId(),
                        orderId: razorpayOrder.id,
                        amount: razorpayOrder.amount,
                        currency: razorpayOrder.currency,
                        name: "GRANTHAE",
                        description: `Payment for ${newOrder.orderID}`,
                        prefill: {
                            name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
                            email: req.user.email || "",
                            contact: newOrder.shippingAddress.phoneNumber || ""
                        }
                    }
                });
            } catch (paymentError) {
                await checkoutService.markRazorpayPaymentFailed(userId, newOrder._id, paymentError.message);
                return res.status(400).json({
                    success: false,
                    message: getFriendlyErrorMessage(paymentError, "Could not initialize payment. Please try another method."),
                    redirectUrl: `/payment-failure/${newOrder._id}`
                });
            }
        }

        delete req.session.checkoutCoupon;

        res.status(200).json({ 
            success: true, 
            message: "Order placed successfully!",
            paymentMethod: newOrder.paymentMethod,
            orderId: newOrder.orderID
        });
    } catch (error) {
        console.error("Place Order Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not place the order. Please try again.") });
    }
};

const normalizeCheckoutAddress = (body) => ({
    label: String(body.label || "").trim().toUpperCase(),
    streetAddress: String(body.streetAddress || "").trim(),
    city: String(body.city || "").trim(),
    state: String(body.state || "").trim(),
    country: String(body.country || "").trim(),
    pinCode: String(body.pinCode || "").trim(),
    phoneNumber: String(body.phoneNumber || "").trim()
});

const validateCheckoutAddress = (addressData) => {
    if (!addressData.label) return "Address label is required.";
    if (!addressData.streetAddress) return "Street address is required.";
    if (!addressData.city) return "City is required.";
    if (!addressData.state) return "State is required.";
    if (!addressData.country) return "Country is required.";
    if (!/^\d{6}$/.test(addressData.pinCode)) return "PIN code must be 6 digits.";
    if (!/^\d{10}$/.test(addressData.phoneNumber)) return "Phone number must be 10 digits.";
    return null;
};

export const addCheckoutAddress = async (req, res) => {
    try {
        const userId = req.user._id;
        const addressData = normalizeCheckoutAddress(req.body);
        const validationError = validateCheckoutAddress(addressData);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const address = await addNewAddressService(addressData, userId);
        res.status(201).json({
            success: true,
            message: "Address added successfully.",
            address: {
                _id: address._id,
                label: address.label,
                streetAddress: address.streetAddress,
                city: address.city,
                state: address.state,
                country: address.country,
                pinCode: address.pinCode,
                phoneNumber: address.phoneNumber,
                isDefault: address.isDefault
            }
        });
    } catch (error) {
        console.error("Add Checkout Address Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not add the address. Please check the details and try again.") });
    }
};

export const applyCoupon = async (req, res) => {
    try {
        const userId = req.user._id;
        const { couponCode } = req.body;
        if (!couponCode || !couponCode.trim()) {
            return res.status(400).json({ success: false, message: "Enter a coupon code." });
        }

        const normalizedCode = couponCode.trim().toUpperCase();
        const appliedCoupon = req.session.checkoutCoupon?.code;

        if (appliedCoupon && appliedCoupon !== normalizedCode) {
            return res.status(409).json({
                success: false,
                message: "Remove the current coupon before applying another one."
            });
        }

        const couponData = await checkoutService.applyCouponToCheckout(userId, couponCode);
        req.session.checkoutCoupon = { code: couponData.couponCode };

        res.status(200).json({
            success: true,
            message: "Coupon applied successfully.",
            ...couponData
        });
    } catch (error) {
        console.error("Apply Coupon Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not apply this coupon.") });
    }
};

export const removeCoupon = async (req, res) => {
    try {
        const userId = req.user._id;
        delete req.session.checkoutCoupon;

        const checkoutData = await checkoutService.getCheckoutData(userId);

        res.status(200).json({
            success: true,
            message: "Coupon removed.",
            couponCode: "",
            discountAmount: 0,
            subtotal: checkoutData.cartTotal,
            totalAmount: checkoutData.cartTotal
        });
    } catch (error) {
        console.error("Remove Coupon Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not remove this coupon.") });
    }
};

export const orderSuccessPage = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user._id;
        const lookup = [{ orderID: orderId }];

        if (mongoose.isValidObjectId(orderId)) {
            lookup.push({ _id: orderId });
        }

        const order = await orderDb.findOne({
            user: userId,
            $or: lookup
        });

        if (!order) {
            return res.redirect('/profile/orders');
        }

        if (order.paymentMethod === "Razorpay" && order.paymentStatus !== "Success") {
            return res.redirect(`/payment-failure/${order._id}`);
        }

        res.render("pages/order-success", {
            title: `Order ${order.orderID} Successful`,
            user: req.user,
            order,
            orderId: order.orderID,
            orderDetailsId: order._id
        });
    } catch (error) {
        console.error("Order Success Page Error:", error);
        res.redirect('/profile/orders');
    }
};

export const paymentFailurePage = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user._id;
        const lookup = [{ orderID: orderId }];

        if (mongoose.isValidObjectId(orderId)) {
            lookup.push({ _id: orderId });
        }

        const order = await orderDb.findOne({
            user: userId,
            $or: lookup
        });

        if (!order) {
            return res.redirect("/profile/orders");
        }

        if (order.paymentMethod !== "Razorpay") {
            return res.redirect(`/profile/orders/${order._id}`);
        }

        if (order.paymentStatus === "Success") {
            return res.redirect(`/order-success/${order.orderID}`);
        }

        res.render("pages/payment-failure", {
            title: "Payment Failed",
            user: req.user,
            order,
            razorpayKeyId: getRazorpayKeyId(),
            razorpayConfigured: isRazorpayConfigured()
        });
    } catch (error) {
        console.error("Payment Failure Page Error:", error);
        res.redirect("/profile/orders");
    }
};

export const retryRazorpayPayment = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;

        if (!isRazorpayConfigured()) {
            return res.status(400).json({ success: false, message: "Razorpay keys are not configured." });
        }

        const order = await checkoutService.getRazorpayRetryOrder(userId, orderId);
        const razorpayOrder = await createRazorpayOrder({
            amount: order.totalAmount,
            receipt: order.orderID,
            notes: {
                orderId: order.orderID,
                internalOrderId: order._id.toString(),
                retry: "true"
            }
        });

        await checkoutService.setRazorpayOrderReference(userId, order._id, razorpayOrder.id);

        res.status(200).json({
            success: true,
            message: "Retry payment initialized.",
            orderId: order.orderID,
            internalOrderId: order._id,
            razorpay: {
                keyId: getRazorpayKeyId(),
                orderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                name: "GRANTHAE",
                description: `Payment for ${order.orderID}`,
                prefill: {
                    name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim(),
                    email: req.user.email || "",
                    contact: order.shippingAddress.phoneNumber || ""
                }
            }
        });
    } catch (error) {
        console.error("Retry Razorpay Payment Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not retry the payment. Please try another method.") });
    }
};

export const verifyRazorpayPayment = async (req, res) => {
    const userId = req.user._id;
    const {
        internalOrderId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
    } = req.body;

    try {
        const order = await checkoutService.verifyAndCompleteRazorpayPayment({
            userId,
            internalOrderId,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
        });

        delete req.session.checkoutCoupon;

        res.status(200).json({
            success: true,
            message: "Payment verified successfully.",
            orderId: order.orderID,
            redirectUrl: `/order-success/${order.orderID}`
        });
    } catch (error) {
        console.error("Verify Razorpay Payment Error:", error);
        if (internalOrderId) {
            try {
                await checkoutService.markRazorpayPaymentFailed(userId, internalOrderId, error.message);
            } catch (markError) {
                console.error("Mark Payment Failed Error:", markError);
            }
        }
        res.status(400).json({
            success: false,
            message: getFriendlyErrorMessage(error, "Payment verification failed. Please try another method."),
            redirectUrl: internalOrderId ? `/payment-failure/${internalOrderId}` : "/checkout"
        });
    }
};

export const markRazorpayPaymentFailed = async (req, res) => {
    try {
        const userId = req.user._id;
        const { internalOrderId, reason } = req.body;

        if (!internalOrderId) {
            return res.status(400).json({ success: false, message: "Order reference is required." });
        }

        const order = await checkoutService.markRazorpayPaymentFailed(userId, internalOrderId, reason);

        res.status(200).json({
            success: true,
            message: "Payment failure recorded.",
            redirectUrl: `/payment-failure/${order._id}`
        });
    } catch (error) {
        console.error("Mark Razorpay Payment Failed Error:", error);
        res.status(400).json({ success: false, message: getFriendlyErrorMessage(error, "Could not record the payment failure.") });
    }
};
