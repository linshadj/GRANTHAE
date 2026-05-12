import cartDb from "../../models/cartDb.js";
import { Product } from "../../models/productDb.js";
import orderDb from "../../models/orderDb.js";
import addressDb from "../../models/addressDb.js";
import { Coupon } from "../../models/couponDb.js";
import userDb from "../../models/userDb.js";
import { verifyRazorpaySignature } from "./razorpayService.js";
import { debitWallet, getWallet } from "./walletService.js";
import { getBestOfferForProduct } from "./offerPricingService.js";
import crypto from "crypto";

const ONLINE_PAYMENT_METHODS = new Set(["Razorpay", "Online"]);

export const getCheckoutData = async (userId) => {
    const cart = await cartDb.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
    });
    
    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty");
    }

    let cartTotal = 0;
    const validatedItems = [];

    for (let item of cart.items) {
        const product = item.product;
        
        if (product.isBlocked || product.isDeleted) {
            throw new Error(`Product "${product.name}" is no longer available.`);
        }
        if (product.category && (product.category.isBlocked || product.category.isDeleted)) {
            throw new Error(`Product "${product.name}" is no longer available because its category is disabled.`);
        }

        let availableStock = 0;
        let price = product.price;

        if (item.variant && product.variants && product.variants.length > 0) {
            const variantData = product.variants.find(v => v.name === item.variant);
            if (variantData) {
                availableStock = variantData.stock;
                if (variantData.priceOverride) price = variantData.priceOverride;
            }
        } else if (product.variants && product.variants.length > 0) {
            throw new Error(`Please select an option for "${product.name}".`);
        }

        if (availableStock < item.quantity) {
             throw new Error(`Insufficient stock for "${product.name}". Only ${availableStock} left.`);
        }

        const originalPrice = price;
        const offer = await getBestOfferForProduct(product, originalPrice);
        price = offer.finalPrice;

        const itemTotal = price * item.quantity;
        cartTotal += itemTotal;

        validatedItems.push({
            productId: product._id,
            productName: product.name,
            coverImage: product.coverImage || (product.images.length > 0 ? product.images[0] : ''),
            variant: item.variant,
            quantity: item.quantity,
            price: price,
            originalPrice,
            offerDiscountAmount: offer.discountAmount,
            offerTitle: offer.title,
            itemTotal: itemTotal,
        });
    }

    const addresses = await addressDb.find({ userId: userId }).sort({ isDefault: -1 });

    return {
        cartItems: validatedItems,
        cartTotal,
        addresses
    };
};

const generateOrderID = () => {
    return 'ORD' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

const roundCurrency = (amount) => Math.round(amount * 100) / 100;

const getCouponUsageForUser = (coupon, userId) => {
    const usage = coupon.usedBy.find(entry => entry.user.toString() === userId.toString());
    return usage ? usage.count : 0;
};

const calculateCouponDiscount = (coupon, subtotal) => {
    let discountAmount = coupon.discountType === "percentage"
        ? subtotal * (coupon.discountValue / 100)
        : coupon.discountValue;

    if (coupon.discountType === "percentage" && coupon.maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }

    return roundCurrency(Math.min(discountAmount, subtotal));
};

const validateCoupon = async (userId, couponCode, subtotal) => {
    const normalizedCode = String(couponCode || "").trim().toUpperCase();
    if (!normalizedCode) {
        return { coupon: null, discountAmount: 0, finalTotal: subtotal };
    }

    const coupon = await Coupon.findOne({ code: normalizedCode, isDeleted: false });
    if (!coupon) throw new Error("Invalid coupon code.");

    const now = new Date();
    if (!coupon.isActive) throw new Error("This coupon is not active.");
    if (coupon.startDate > now) throw new Error("This coupon is not active yet.");
    if (coupon.expiresAt < now) throw new Error("This coupon has expired.");
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) throw new Error("This coupon has reached its usage limit.");
    if (subtotal < coupon.minPurchaseAmount) {
        throw new Error(`This coupon requires a minimum order value of ₹${coupon.minPurchaseAmount}.`);
    }

    const userUsage = getCouponUsageForUser(coupon, userId);
    if (coupon.usageLimitPerUser > 0 && userUsage >= coupon.usageLimitPerUser) {
        throw new Error("You have already used this coupon.");
    }

    const discountAmount = calculateCouponDiscount(coupon, subtotal);

    return {
        coupon,
        discountAmount,
        finalTotal: roundCurrency(subtotal - discountAmount),
    };
};

const applyCouponUsage = async (coupon, userId) => {
    if (!coupon) return;

    const userUsage = coupon.usedBy.find(entry => entry.user.toString() === userId.toString());
    if (userUsage) {
        userUsage.count += 1;
    } else {
        coupon.usedBy.push({ user: userId, count: 1 });
    }
    coupon.usedCount += 1;
    await coupon.save();
};

const applyCouponUsageForOrder = async (order) => {
    if (!order.couponCode) return;

    const coupon = await Coupon.findOne({ code: order.couponCode, isDeleted: false });
    await applyCouponUsage(coupon, order.user);
};

export const getAvailableCouponsForCheckout = async (userId, subtotal = 0) => {
    const now = new Date();
    const coupons = await Coupon.find({
        isDeleted: false,
        isActive: true,
        startDate: { $lte: now },
        expiresAt: { $gte: now }
    }).sort({ discountValue: -1, expiresAt: 1 }).limit(12);

    return coupons
        .filter((coupon) => {
            if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return false;
            const userUsage = getCouponUsageForUser(coupon, userId);
            return !(coupon.usageLimitPerUser > 0 && userUsage >= coupon.usageLimitPerUser);
        })
        .map((coupon) => {
            const isApplicable = Number(subtotal || 0) >= Number(coupon.minPurchaseAmount || 0);
            const discountAmount = isApplicable ? calculateCouponDiscount(coupon, subtotal) : 0;

            return {
                _id: coupon._id,
                code: coupon.code,
                description: coupon.description,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                minPurchaseAmount: coupon.minPurchaseAmount || 0,
                maxDiscountAmount: coupon.maxDiscountAmount || 0,
                expiresAt: coupon.expiresAt,
                discountAmount,
                isApplicable
            };
        });
};

const normalizePaymentMethod = (paymentMethod) => {
    if (paymentMethod === "Online") return "Razorpay";
    return paymentMethod;
};

const isRazorpayPayment = (paymentMethod) => ONLINE_PAYMENT_METHODS.has(paymentMethod);

const validateOrderStock = async (items) => {
    for (let item of items) {
        const product = await Product.findById(item.product).populate("category");

        if (!product || product.isBlocked || product.isDeleted) {
            throw new Error(`Product "${product?.name || "Unknown"}" is unavailable.`);
        }
        if (product.category && (product.category.isBlocked || product.category.isDeleted)) {
            throw new Error(`Product "${product.name}" is unavailable because its category is disabled.`);
        }

        if (item.variant) {
            const variantData = product.variants.find(v => v.name === item.variant);
            if (!variantData || variantData.stock < item.quantity) {
                throw new Error(`Insufficient stock for "${product.name}".`);
            }
        } else if (product.variants && product.variants.length > 0) {
            throw new Error(`Please select an option for "${product.name}".`);
        } else {
            throw new Error(`Insufficient stock for "${product.name}".`);
        }
    }
};

const updateStockForOrderItems = async (items, direction) => {
    for (let item of items) {
        const quantityChange = Number(item.quantity) * direction;
        if (item.variant) {
            await Product.updateOne(
                { _id: item.product, "variants.name": item.variant },
                { $inc: { "variants.$.stock": quantityChange } }
            );
        }
    }
};

const clearCart = async (userId) => {
    await cartDb.updateOne({ user: userId }, { $set: { items: [] } });
};

export const applyCouponToCheckout = async (userId, couponCode) => {
    const checkoutData = await getCheckoutData(userId);
    const discountData = await validateCoupon(userId, couponCode, checkoutData.cartTotal);

    return {
        couponCode: discountData.coupon?.code || "",
        discountAmount: discountData.discountAmount,
        subtotal: checkoutData.cartTotal,
        totalAmount: discountData.finalTotal,
    };
};

export const placeOrder = async (userId, addressId, paymentMethod, couponCode = "") => {
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    if (!["COD", "Razorpay", "Wallet"].includes(normalizedPaymentMethod)) {
        throw new Error("Select a valid payment method.");
    }

    const address = await addressDb.findOne({ _id: addressId, userId });
    if (!address) {
        throw new Error("Invalid address selected.");
    }

    const cart = await cartDb.findOne({ user: userId }).populate({
        path: 'items.product',
        populate: { path: 'category' }
    });
    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty.");
    }

    let subtotalAmount = 0;
    const orderItems = [];

    // Verify stock one last time and build order items
    for (let item of cart.items) {
        const product = await Product.findById(item.product._id).populate('category');
        
        if (!product || product.isBlocked || product.isDeleted) {
             throw new Error(`Product "${product?.name || 'Unknown'}" is unavailable.`);
        }
        if (product.category && (product.category.isBlocked || product.category.isDeleted)) {
             throw new Error(`Product "${product.name}" is unavailable because its category is disabled.`);
        }

        let availableStock = 0;
        let price = product.price;

        if (item.variant) {
            const variantData = product.variants.find(v => v.name === item.variant);
            if (variantData) {
                availableStock = variantData.stock;
                if (variantData.priceOverride) price = variantData.priceOverride;
            }
        }

        if (availableStock < item.quantity) {
             throw new Error(`Insufficient stock for "${product.name}". Only ${availableStock} left.`);
        }

        const originalPrice = price;
        const offer = await getBestOfferForProduct(product, originalPrice);
        price = offer.finalPrice;

        subtotalAmount += (price * item.quantity);
        orderItems.push({
            product: product._id,
            variant: item.variant,
            quantity: item.quantity,
            price: price,
            offerDiscountAmount: offer.discountAmount,
            offerTitle: offer.title,
            itemStatus: 'Pending'
        });
    }

    const discountData = await validateCoupon(userId, couponCode, subtotalAmount);
    const totalAmount = discountData.finalTotal;
    const shouldAdjustStockNow = normalizedPaymentMethod === "COD";

    if (normalizedPaymentMethod === "Wallet") {
        const wallet = await getWallet(userId);
        if (Number(wallet.balance || 0) < totalAmount) {
            throw new Error("Insufficient wallet balance.");
        }
    }

    if (shouldAdjustStockNow) {
        await updateStockForOrderItems(orderItems, -1);
    }

    const user = await userDb.findById(userId);

    // Create Order
    const newOrder = await orderDb.create({
        orderID: generateOrderID(),
        user: userId,
        items: orderItems,
        shippingAddress: {
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: address.phoneNumber,
            streetAddress: address.streetAddress,
            city: address.city,
            state: address.state,
            pinCode: address.pinCode,
            country: address.country
        },
        subtotalAmount,
        discountAmount: discountData.discountAmount,
        couponCode: discountData.coupon?.code || "",
        totalAmount: totalAmount,
        paymentMethod: normalizedPaymentMethod,
        paymentGateway: isRazorpayPayment(normalizedPaymentMethod) ? "Razorpay" : "",
        paymentStatus: 'Pending',
        orderStatus: 'Pending',
        stockAdjusted: shouldAdjustStockNow
    });

    if (normalizedPaymentMethod === "COD") {
        await applyCouponUsage(discountData.coupon, userId);
        cart.items = [];
        await cart.save();
    }

    if (normalizedPaymentMethod === "Wallet") {
        if (totalAmount > 0) {
            await debitWallet(
                userId,
                totalAmount,
                `Wallet payment for order ${newOrder.orderID}`,
                "order_payment",
                newOrder._id.toString()
            );
        }
        await updateStockForOrderItems(orderItems, -1);
        newOrder.stockAdjusted = true;
        newOrder.paymentStatus = "Success";
        newOrder.paidAt = new Date();
        await applyCouponUsage(discountData.coupon, userId);
        cart.items = [];
        await cart.save();
        await newOrder.save();
    }

    return newOrder;
};

export const setRazorpayOrderReference = async (userId, internalOrderId, razorpayOrderId) => {
    const order = await orderDb.findOne({ _id: internalOrderId, user: userId });
    if (!order) throw new Error("Order not found.");
    if (order.paymentMethod !== "Razorpay") throw new Error("This order is not eligible for Razorpay payment.");
    if (order.paymentStatus === "Success") throw new Error("Payment is already completed for this order.");
    if (order.orderStatus === "Cancelled") throw new Error("Cancelled orders cannot be paid.");

    order.razorpayOrderId = razorpayOrderId;
    order.paymentStatus = "Pending";
    order.paymentFailureReason = "";
    await order.save();

    return order;
};

export const getRazorpayRetryOrder = async (userId, orderId) => {
    const order = await orderDb.findOne({ _id: orderId, user: userId });
    if (!order) throw new Error("Order not found.");
    if (order.paymentMethod !== "Razorpay") throw new Error("This order is not eligible for online retry.");
    if (order.paymentStatus === "Success") throw new Error("Payment is already completed for this order.");
    if (order.orderStatus === "Cancelled") throw new Error("Cancelled orders cannot be retried.");
    if (!order.totalAmount || order.totalAmount <= 0) throw new Error("Invalid order amount.");

    return order;
};

export const markRazorpayPaymentFailed = async (userId, orderId, reason = "Payment failed or was cancelled.") => {
    const order = await orderDb.findOne({ _id: orderId, user: userId });
    if (!order) throw new Error("Order not found.");
    if (order.paymentMethod !== "Razorpay") throw new Error("This order is not a Razorpay order.");
    if (order.paymentStatus === "Success") return order;

    order.paymentStatus = "Failed";
    order.paymentFailureReason = String(reason || "Payment failed or was cancelled.").slice(0, 300);
    await order.save();

    return order;
};

export const verifyAndCompleteRazorpayPayment = async ({
    userId,
    internalOrderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature
}) => {
    const order = await orderDb.findOne({ _id: internalOrderId, user: userId });
    if (!order) throw new Error("Order not found.");
    if (order.paymentMethod !== "Razorpay") throw new Error("This order is not a Razorpay order.");
    if (order.paymentStatus === "Success") return order;
    if (order.razorpayOrderId !== razorpayOrderId) throw new Error("Payment reference mismatch.");

    const isValidSignature = verifyRazorpaySignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
    });
    if (!isValidSignature) {
        throw new Error("Payment verification failed.");
    }

    if (!order.stockAdjusted) {
        await validateOrderStock(order.items);
        await updateStockForOrderItems(order.items, -1);
        order.stockAdjusted = true;
    }

    order.paymentStatus = "Success";
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.paymentFailureReason = "";
    order.paidAt = new Date();

    await applyCouponUsageForOrder(order);
    await clearCart(userId);
    await order.save();

    return order;
};
