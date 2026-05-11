import { Coupon } from "../../models/couponDb.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDateBoundary = (value, boundary = "start") => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return date;

  if (boundary === "end") {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
};

const buildCouponQuery = ({ search = "", filter = "all" }) => {
  const now = new Date();
  const query = {};
  const andConditions = [];

  if (search) {
    andConditions.push({
      $or: [
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    });
  }

  if (filter === "active") {
    Object.assign(query, {
      isDeleted: false,
      isActive: true,
      startDate: { $lte: now },
      expiresAt: { $gte: now },
    });
    andConditions.push({ $or: [{ usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] });
  } else if (filter === "inactive") {
    Object.assign(query, { isDeleted: false, isActive: false });
  } else if (filter === "scheduled") {
    Object.assign(query, { isDeleted: false, startDate: { $gt: now } });
  } else if (filter === "expired") {
    Object.assign(query, { isDeleted: false, expiresAt: { $lt: now } });
  } else if (filter === "used-up") {
    Object.assign(query, {
      isDeleted: false,
      usageLimit: { $gt: 0 },
    });
    andConditions.push({ $expr: { $gte: ["$usedCount", "$usageLimit"] } });
  } else if (filter === "deleted") {
    Object.assign(query, { isDeleted: true });
  }

  if (andConditions.length > 0) {
    query.$and = andConditions;
  }

  return query;
};

const buildCouponSort = (sort) => {
  if (sort === "code-a-z") return { code: 1 };
  if (sort === "code-z-a") return { code: -1 };
  if (sort === "expires") return { expiresAt: 1 };
  if (sort === "oldest") return { createdAt: 1 };
  return { createdAt: -1 };
};

const normalizeCouponPayload = (body) => {
  return {
    code: String(body.code || "").trim().toUpperCase(),
    description: String(body.description || "").trim(),
    discountType: body.discountType === "fixed" ? "fixed" : "percentage",
    discountValue: parseNumber(body.discountValue),
    minPurchaseAmount: parseNumber(body.minPurchaseAmount),
    maxDiscountAmount: parseNumber(body.maxDiscountAmount),
    usageLimit: parseNumber(body.usageLimit),
    usageLimitPerUser: parseNumber(body.usageLimitPerUser, 1),
    startDate: parseDateBoundary(body.startDate, "start"),
    expiresAt: parseDateBoundary(body.expiresAt, "end"),
    isActive: body.isActive === true || body.isActive === "true" || body.isActive === "on",
  };
};

const couponErrorMessage = (error) => {
  if (error?.code === 11000) return "A coupon with this code already exists.";
  if (error?.name === "ValidationError") {
    return Object.values(error.errors || {})[0]?.message || "Coupon validation failed.";
  }
  if (error?.name === "CastError") return "Invalid coupon details.";
  return error?.message || "Something went wrong while saving the coupon.";
};

const validateCouponPayload = async (payload, excludedId = null) => {
  if (!payload.code) return "Coupon code is required.";
  if (!payload.discountValue || payload.discountValue <= 0) return "Discount value must be greater than zero.";
  if (payload.discountType === "percentage" && payload.discountValue > 100) return "Percentage discount cannot exceed 100%.";
  if (!payload.minPurchaseAmount || payload.minPurchaseAmount <= 0) return "Minimum order value must be greater than zero.";
  if (payload.discountValue >= payload.minPurchaseAmount) return "Discount value must be less than the minimum order value.";
  if (payload.maxDiscountAmount < 0) return "Max discount cannot be negative.";
  if (payload.discountType === "percentage" && (!payload.maxDiscountAmount || payload.maxDiscountAmount <= 0)) {
    return "Max discount is required for percentage coupons.";
  }
  if (payload.discountType === "percentage" && payload.maxDiscountAmount >= payload.minPurchaseAmount) {
    return "Max discount must be less than the minimum order value.";
  }
  if (payload.usageLimit < 0) return "Total usage limit cannot be negative.";
  if (payload.usageLimitPerUser < 0) return "Usage limit per user cannot be negative.";
  if (!payload.startDate || Number.isNaN(payload.startDate.getTime())) return "Start date is required.";
  if (!payload.expiresAt || Number.isNaN(payload.expiresAt.getTime())) return "Expiry date is required.";
  if (payload.expiresAt < payload.startDate) return "Expiry date cannot be before the start date.";

  const duplicateQuery = { code: payload.code };
  if (excludedId) duplicateQuery._id = { $ne: excludedId };

  const existingCoupon = await Coupon.findOne(duplicateQuery);
  if (existingCoupon) return "A coupon with this code already exists.";

  return null;
};

export const couponsPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const searchQuery = req.query.search || "";
    const selectedFilter = req.query.filter || "all";
    const selectedSort = req.query.sort || "newest";
    const query = buildCouponQuery({ search: searchQuery, filter: selectedFilter });

    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);
    const coupons = await Coupon.find(query)
      .sort(buildCouponSort(selectedSort))
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("admin/coupons", {
      layout: "layouts/admin-panel",
      title: "Coupon Management",
      coupons,
      currentPage: page,
      totalPages,
      totalCoupons,
      searchQuery,
      selectedFilter,
      selectedSort,
      path: "/admin/coupons",
    });
  } catch (error) {
    next(error);
  }
};

export const getAddCouponPage = (req, res) => {
  res.render("admin/edit-coupon", {
    layout: "layouts/admin-panel",
    title: "Add Coupon",
    mode: "add",
    coupon: null,
    path: "/admin/coupons",
  });
};

export const getEditCouponPage = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return res.redirect("/admin/coupons");

    res.render("admin/edit-coupon", {
      layout: "layouts/admin-panel",
      title: "Edit Coupon",
      mode: "edit",
      coupon,
      path: "/admin/coupons",
    });
  } catch (error) {
    next(error);
  }
};

export const addCoupon = async (req, res, next) => {
  try {
    const payload = normalizeCouponPayload(req.body);
    const validationError = await validateCouponPayload(payload);
    if (validationError) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: validationError });
    }

    await Coupon.create(payload);
    return res.status(STATUS_CODES.CREATED).json({
      success: true,
      message: "Coupon created successfully.",
      redirectUrl: "/admin/coupons",
    });
  } catch (error) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: couponErrorMessage(error) });
  }
};

export const editCoupon = async (req, res, next) => {
  try {
    const payload = normalizeCouponPayload(req.body);
    const validationError = await validateCouponPayload(payload, req.params.id);
    if (validationError) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: validationError });
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!coupon) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Coupon not found." });
    }

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: "Coupon updated successfully.",
      redirectUrl: "/admin/coupons",
    });
  } catch (error) {
    return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: couponErrorMessage(error) });
  }
};

export const toggleCouponStatus = async (req, res, next) => {
  try {
    const isDeleted = req.params.action === "delete";
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { isDeleted }, { new: true });

    if (!coupon) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Coupon not found." });
    }

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: `Coupon ${isDeleted ? "deleted" : "restored"} successfully.`,
    });
  } catch (error) {
    next(error);
  }
};
