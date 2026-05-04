import mongoose from "mongoose";

const wishlistItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    variant: {
        type: String,
        default: ""
    }
});

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        unique: true
    },
    items: [wishlistItemSchema]
}, {
    timestamps: true
});

const wishlistDb = mongoose.model('wishlist', wishlistSchema);
export default wishlistDb;
