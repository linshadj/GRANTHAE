import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
    },
    rental: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Rental",
    },
    targetType: {
        type: String,
        enum: ["product", "rental"],
        default: "product",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true });

reviewSchema.pre("validate", function validateReviewTarget() {
    if (this.targetType === "rental") {
        if (!this.rental) throw new Error("Rental review target is required.");
        if (!this.product) this.product = this.rental;
        return;
    }

    if (!this.product) throw new Error("Product review target is required.");
    this.rental = undefined;
});

reviewSchema.index(
    { product: 1, user: 1 },
    { unique: true, partialFilterExpression: { product: { $exists: true } } }
);
reviewSchema.index(
    { rental: 1, user: 1 },
    { unique: true, partialFilterExpression: { rental: { $exists: true } } }
);
reviewSchema.index({ product: 1, targetType: 1 });
reviewSchema.index({ rental: 1, targetType: 1 });

export const Review = mongoose.model("Review", reviewSchema);
