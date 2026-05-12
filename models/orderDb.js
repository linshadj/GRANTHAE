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
        offerDiscountAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        offerTitle: {
            type: String,
            default: "",
            trim: true
        },
        itemStatus: {
            type: String,
            enum: ['Pending', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
            default: 'Pending'
        },
        cancellationReason: {
            type: String
        },
        returnReason: {
            type: String
        },
        returnRequestStatus: {
            type: String,
            enum: ['None', 'Pending', 'Approved', 'Rejected'],
            default: 'None'
        },
        returnRequestedAt: {
            type: Date
        },
        returnReviewedAt: {
            type: Date
        },
        returnRejectionReason: {
            type: String,
            default: ""
        },
        refundAmount: {
            type: Number,
            default: 0,
            min: 0
        },
        refundStatus: {
            type: String,
            enum: ['None', 'Pending', 'Completed', 'Failed'],
            default: 'None'
        },
        refundedAt: {
            type: Date
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
    subtotalAmount: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    refundedAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    couponCode: {
        type: String,
        default: "",
        trim: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'Online', 'Razorpay', 'Wallet']
    },
    paymentGateway: {
        type: String,
        enum: ['', 'Razorpay', 'PayPal'],
        default: ''
    },
    paymentStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Success', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    razorpayOrderId: {
        type: String,
        default: ""
    },
    razorpayPaymentId: {
        type: String,
        default: ""
    },
    razorpaySignature: {
        type: String,
        default: ""
    },
    paymentFailureReason: {
        type: String,
        default: ""
    },
    paidAt: {
        type: Date
    },
    stockAdjusted: {
        type: Boolean,
        default: true
    },
    orderStatus: {
        type: String,
        required: true,
        enum: ['Pending', 'Shipped', 'Out for delivery', 'Delivered', 'Cancelled', 'Returned'],
        default: 'Pending'
    }
}, {
    timestamps: true
});

const orderDb = mongoose.model('order', orderSchema);

export default orderDb;
