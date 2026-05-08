import cartDb from "../../models/cartDb.js";
import { Product } from "../../models/productDb.js";
import orderDb from "../../models/orderDb.js";
import addressDb from "../../models/addressDb.js";
import { Coupon } from "../../models/couponDb.js";
import crypto from "crypto";

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

        const itemTotal = price * item.quantity;
        cartTotal += itemTotal;

        validatedItems.push({
            productId: product._id,
            productName: product.name,
            coverImage: product.coverImage || (product.images.length > 0 ? product.images[0] : ''),
            variant: item.variant,
            quantity: item.quantity,
            price: price,
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
    if (paymentMethod !== 'COD') {
        throw new Error("Only Cash on Delivery is supported right now.");
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

        subtotalAmount += (price * item.quantity);
        orderItems.push({
            product: product._id,
            variant: item.variant,
            quantity: item.quantity,
            price: price,
            itemStatus: 'Pending'
        });
    }

    const discountData = await validateCoupon(userId, couponCode, subtotalAmount);
    const totalAmount = discountData.finalTotal;

    // Deduct stock
    for (let item of cart.items) {
        if (item.variant) {
            await Product.updateOne(
                { _id: item.product._id, "variants.name": item.variant },
                { $inc: { "variants.$.stock": -item.quantity } }
            );
        }
    }

    const userDb = (await import("../../models/userDb.js")).default;
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
        paymentMethod: paymentMethod,
        paymentStatus: 'Pending',
        orderStatus: 'Pending'
    });

    if (discountData.coupon) {
        const userUsage = discountData.coupon.usedBy.find(entry => entry.user.toString() === userId.toString());
        if (userUsage) {
            userUsage.count += 1;
        } else {
            discountData.coupon.usedBy.push({ user: userId, count: 1 });
        }
        discountData.coupon.usedCount += 1;
        await discountData.coupon.save();
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    return newOrder;
};
