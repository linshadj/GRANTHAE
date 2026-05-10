import mongoose from "mongoose";

const rentalOrderSchema = new mongoose.Schema({
    rental: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rental",
        required: true
    },
    renter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    rentalCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    durationDays: {
        type: Number,
        required: true,
        min: 1
    },
    dailyRate: {
        type: Number,
        required: true,
        min: 0
    },
    rentalCharge: {
        type: Number,
        required: true,
        min: 0
    },
    depositAmount: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ["Requested", "Active", "Rejected", "Return Requested", "Returned", "Cancelled"],
        default: "Requested"
    },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Deposit Refunded", "Refunded", "Cancelled"],
        default: "Pending"
    },
    requestedAt: {
        type: Date
    },
    confirmedAt: {
        type: Date
    },
    rejectedAt: {
        type: Date
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: ""
    },
    returnCondition: {
        type: String,
        enum: ["", "Excellent", "Good", "Fair", "Damaged"],
        default: ""
    },
    returnTrackingId: {
        type: String,
        trim: true,
        default: ""
    },
    returnComments: {
        type: String,
        trim: true,
        default: ""
    },
    returnRequestedAt: {
        type: Date
    },
    returnedAt: {
        type: Date
    },
    depositRefundedAt: {
        type: Date
    }
}, { timestamps: true });

rentalOrderSchema.index({ renter: 1, createdAt: -1 });
rentalOrderSchema.index({ owner: 1, createdAt: -1 });
rentalOrderSchema.index({ rental: 1, status: 1 });

const rentalOrderDb = mongoose.model("rentalOrder", rentalOrderSchema);

export default rentalOrderDb;
