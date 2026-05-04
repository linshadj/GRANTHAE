import mongoose from "mongoose";

const rentalSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },

    bookTitle: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: String,
        required: true,
        trim: true
    },
    isbn: {
        type: String,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    dailyRate: {
        type: Number,
        required: true,
        min: 0
    },
    bookCondition: {
        type: String,
        required: true,
        enum: ["New", "Fine", "Very Good", "Good", "Fair", "Poor"]
    },
    minRentalDays: {
        type: Number,
        required: true,
        min: 1
    },
    depositAmount: {
        type: Number,
        required: true,
        min: 0
    },
    images: {
        type: [String],
        required: true,
        validate: [arrayLimit, "Rental books must have at least 3 images"]
    },
    coverImage: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "Pending",
        enum: ["Pending", "Approved", "Rejected", "Available", "Rented", "Hidden"]
    },
    rejectionReason: {
        type: String,
        trim: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

function arrayLimit(val) {
    return val.length >= 3;
}

export const Rental = mongoose.model("Rental", rentalSchema);
