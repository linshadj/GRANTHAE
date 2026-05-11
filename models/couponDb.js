import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
      default: "percentage",
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minPurchaseAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usageLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    usageLimitPerUser: {
      type: Number,
      default: 1,
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedBy: {
      type: [couponUsageSchema],
      default: [],
    },
    startDate: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

couponSchema.virtual("status").get(function () {
  const now = new Date();

  if (this.isDeleted) return "Deleted";
  if (!this.isActive) return "Inactive";
  if (this.startDate && this.startDate > now) return "Scheduled";
  if (this.expiresAt && this.expiresAt < now) return "Expired";
  if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) return "Used Up";
  return "Active";
});

couponSchema.pre("validate", function normalizeCouponCode() {
  if (this.code) this.code = this.code.trim().toUpperCase();
  if (this.discountValue >= this.minPurchaseAmount) {
    this.invalidate("discountValue", "Discount value must be less than the minimum order value.");
  }
  if (this.discountType === "percentage" && (!this.maxDiscountAmount || this.maxDiscountAmount <= 0)) {
    this.invalidate("maxDiscountAmount", "Max discount is required for percentage coupons.");
  }
  if (this.discountType === "percentage" && this.maxDiscountAmount >= this.minPurchaseAmount) {
    this.invalidate("maxDiscountAmount", "Max discount must be less than the minimum order value.");
  }
});

export const Coupon = mongoose.model("Coupon", couponSchema);
