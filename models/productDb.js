import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
    name: { type: String, required: true }, 
    priceOverride: { type: Number, min: 0 },
    stock: { type: Number, min: 0, required: true },
    sku: { type: String, required: true, trim: true }
});

const productSchema = new mongoose.Schema({
    name: {
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
    description: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    variants: [variantSchema],
    coverImage: {
        type: String,
        default: ""
    },
    featured: {
        type: Boolean,
        default: false
    },
    images: {
        type: [String],
        required: true,
        validate: [arrayLimit, "Products must have at least 3 images"]
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    brand: {
        type: String,
        trim: true,
        default: ""
    },
    highlights: {
        type: [String],
        default: []
    }
}, { timestamps: true });

function arrayLimit(val) {
    return val.length >= 3;
}

export const Product = mongoose.model("Product", productSchema);
