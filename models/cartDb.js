import mongoose from "mongoose";
import { MAX_CART_QUANTITY_PER_ITEM } from "../utils/cartLimits.js";

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    variant: {
        type: String,
        default: ""
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        max: MAX_CART_QUANTITY_PER_ITEM,
        default: 1
    }
});

const cartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        unique: true
    },
    items: [cartItemSchema]
}, {
    timestamps: true
});

const cartDb = mongoose.model('cart', cartSchema);
export default cartDb;
