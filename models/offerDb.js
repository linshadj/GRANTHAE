import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
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
    appliesTo: {
      type: String,
      enum: ["all", "categories", "products"],
      default: "all",
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
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

offerSchema.virtual("status").get(function () {
  const now = new Date();

  if (this.isDeleted) return "Deleted";
  if (!this.isActive) return "Inactive";
  if (this.startDate && this.startDate > now) return "Scheduled";
  if (this.endDate && this.endDate < now) return "Expired";
  return "Active";
});

offerSchema.index({ isDeleted: 1, isActive: 1, startDate: 1, endDate: 1, appliesTo: 1 });
offerSchema.index({ appliesTo: 1, products: 1 });
offerSchema.index({ appliesTo: 1, categories: 1 });

export const Offer = mongoose.model("Offer", offerSchema);
