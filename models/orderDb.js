import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    orderID: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variant: {
            type: String
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        itemStatus: {
            type: String,
            enum: ['Pending', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled', 'Returned'],
            default: 'Pending'
        },
        cancellationReason: {
            type: String
        },
        returnReason: {
            type: String
        }
    }],
    shippingAddress: {
        firstName: String,
        lastName: String,
        email: String,
        phoneNumber: String,
        streetAddress: String,
        city: String,
        state: String,
        pinCode: String,
        country: String
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'Online', 'Wallet']
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Success', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    orderStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled'],
        default: 'Pending'
    }
}, {
    timestamps: true
});

const orderDb = mongoose.model('order', orderSchema);

export default orderDb;
