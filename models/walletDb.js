import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ["credit", "debit"],
        required: true
    },
    source: {
        type: String,
        enum: ["add_funds", "order_payment", "order_refund", "rental_income", "adjustment"],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ["completed", "pending", "failed"],
        default: "completed"
    },
    referenceId: {
        type: String,
        default: "",
        trim: true
    },
    balanceAfter: {
        type: Number,
        required: true,
        min: 0
    }
}, { timestamps: true });

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: "INR",
        trim: true
    },
    transactions: [walletTransactionSchema]
}, { timestamps: true });

const walletDb = mongoose.model("wallet", walletSchema);

export default walletDb;
