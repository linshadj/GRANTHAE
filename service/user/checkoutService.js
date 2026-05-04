import cartDb from "../../models/cartDb.js";
import { Product } from "../../models/productDb.js";
import orderDb from "../../models/orderDb.js";
import addressDb from "../../models/addressDb.js";
import crypto from "crypto";

export const getCheckoutData = async (userId) => {
    const cart = await cartDb.findOne({ user: userId }).populate('items.product');
    
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

export const placeOrder = async (userId, addressId, paymentMethod) => {
    if (paymentMethod !== 'COD') {
        throw new Error("Only Cash on Delivery is supported right now.");
    }

    const address = await addressDb.findOne({ _id: addressId, userId });
    if (!address) {
        throw new Error("Invalid address selected.");
    }

    const cart = await cartDb.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
        throw new Error("Cart is empty.");
    }

    let totalAmount = 0;
    const orderItems = [];

    // Verify stock one last time and build order items
    for (let item of cart.items) {
        const product = await Product.findById(item.product._id);
        
        if (!product || product.isBlocked || product.isDeleted) {
             throw new Error(`Product "${product?.name || 'Unknown'}" is unavailable.`);
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

        totalAmount += (price * item.quantity);
        orderItems.push({
            product: product._id,
            variant: item.variant,
            quantity: item.quantity,
            price: price,
            itemStatus: 'Pending'
        });
    }

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
        totalAmount: totalAmount,
        paymentMethod: paymentMethod,
        paymentStatus: 'Pending',
        orderStatus: 'Pending'
    });

    // Clear cart
    cart.items = [];
    await cart.save();

    return newOrder;
};
