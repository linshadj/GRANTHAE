import mongoose from "mongoose";

const referralSchema = new mongoose.Schema({
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
    },
    referee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        unique: true,
    },
    referralCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: "",
    },
    referralToken: {
        type: String,
        trim: true,
        default: "",
    },
    source: {
        type: String,
        enum: ["code", "token"],
        required: true,
    },
    referrerReward: {
        type: Number,
        default: 0,
        min: 0,
    },
    refereeReward: {
        type: Number,
        default: 0,
        min: 0,
    },
    status: {
        type: String,
        enum: ["completed", "failed"],
        default: "completed",
    },
    rewardedAt: {
        type: Date,
    },
}, { timestamps: true });

referralSchema.index({ referrer: 1, createdAt: -1 });

const referralDb = mongoose.model("referral", referralSchema);

export default referralDb;
