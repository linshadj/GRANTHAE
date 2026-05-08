import { Category } from "../../models/categoryDb.js";
import { Offer } from "../../models/offerDb.js";
import { Product } from "../../models/productDb.js";
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

const normalizeIdList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
};

const buildOfferQuery = ({ search = "", filter = "all" }) => {
  const now = new Date();
  const query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (filter === "active") {
    Object.assign(query, {
      isDeleted: false,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    });
  } else if (filter === "inactive") {
    Object.assign(query, { isDeleted: false, isActive: false });
  } else if (filter === "scheduled") {
    Object.assign(query, { isDeleted: false, startDate: { $gt: now } });
  } else if (filter === "expired") {
    Object.assign(query, { isDeleted: false, endDate: { $lt: now } });
  } else if (filter === "deleted") {
    Object.assign(query, { isDeleted: true });
  }

  return query;
};

const buildOfferSort = (sort) => {
  if (sort === "title-a-z") return { title: 1 };
  if (sort === "title-z-a") return { title: -1 };
  if (sort === "ends") return { endDate: 1 };
  if (sort === "oldest") return { createdAt: 1 };
  return { createdAt: -1 };
};

const normalizeOfferPayload = (body) => {
  const appliesTo = ["all", "categories", "products"].includes(body.appliesTo) ? body.appliesTo : "all";

  return {
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    discountType: body.discountType === "fixed" ? "fixed" : "percentage",
    discountValue: parseNumber(body.discountValue),
    appliesTo,
    categories: appliesTo === "categories" ? normalizeIdList(body.categories) : [],
    products: appliesTo === "products" ? normalizeIdList(body.products) : [],
    startDate: parseDateBoundary(body.startDate, "start"),
    endDate: parseDateBoundary(body.endDate, "end"),
    isActive: body.isActive === true || body.isActive === "true" || body.isActive === "on",
  };
};

const validateOfferPayload = (payload) => {
  if (!payload.title) return "Offer title is required.";
  if (!payload.discountValue || payload.discountValue <= 0) return "Discount value must be greater than zero.";
  if (payload.discountType === "percentage" && payload.discountValue > 100) return "Percentage discount cannot exceed 100%.";
  if (!payload.startDate || Number.isNaN(payload.startDate.getTime())) return "Start date is required.";
  if (!payload.endDate || Number.isNaN(payload.endDate.getTime())) return "End date is required.";
  if (payload.endDate < payload.startDate) return "End date cannot be before the start date.";
  if (payload.appliesTo === "categories" && payload.categories.length === 0) return "Choose at least one category.";
  if (payload.appliesTo === "products" && payload.products.length === 0) return "Choose at least one product.";
  return null;
};

const getOfferFormOptions = async () => {
  const [categories, products] = await Promise.all([
    Category.find({ isDeleted: false }).sort({ name: 1 }),
    Product.find({ isDeleted: false }).select("name author").sort({ name: 1 }),
  ]);

  return { categories, products };
};

export const offersPage = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const searchQuery = req.query.search || "";
    const selectedFilter = req.query.filter || "all";
    const selectedSort = req.query.sort || "newest";
    const query = buildOfferQuery({ search: searchQuery, filter: selectedFilter });

    const totalOffers = await Offer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit);
    const offers = await Offer.find(query)
      .populate("categories", "name")
      .populate("products", "name")
      .sort(buildOfferSort(selectedSort))
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("admin/offers", {
      layout: "layouts/admin-panel",
      title: "Offer Management",
      offers,
      currentPage: page,
      totalPages,
      totalOffers,
      searchQuery,
      selectedFilter,
      selectedSort,
      path: "/admin/offers",
    });
  } catch (error) {
    next(error);
  }
};

export const getAddOfferPage = async (req, res, next) => {
  try {
    const options = await getOfferFormOptions();
    res.render("admin/edit-offer", {
      layout: "layouts/admin-panel",
      title: "Add Offer",
      mode: "add",
      offer: null,
      path: "/admin/offers",
      ...options,
    });
  } catch (error) {
    next(error);
  }
};

export const getEditOfferPage = async (req, res, next) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.redirect("/admin/offers");

    const options = await getOfferFormOptions();
    res.render("admin/edit-offer", {
      layout: "layouts/admin-panel",
      title: "Edit Offer",
      mode: "edit",
      offer,
      path: "/admin/offers",
      ...options,
    });
  } catch (error) {
    next(error);
  }
};

export const addOffer = async (req, res, next) => {
  try {
    const payload = normalizeOfferPayload(req.body);
    const validationError = validateOfferPayload(payload);
    if (validationError) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: validationError });
    }

    await Offer.create(payload);
    return res.status(STATUS_CODES.CREATED).json({
      success: true,
      message: "Offer created successfully.",
      redirectUrl: "/admin/offers",
    });
  } catch (error) {
    next(error);
  }
};

export const editOffer = async (req, res, next) => {
  try {
    const payload = normalizeOfferPayload(req.body);
    const validationError = validateOfferPayload(payload);
    if (validationError) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: validationError });
    }

    const offer = await Offer.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!offer) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Offer not found." });
    }

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: "Offer updated successfully.",
      redirectUrl: "/admin/offers",
    });
  } catch (error) {
    next(error);
  }
};

export const toggleOfferStatus = async (req, res, next) => {
  try {
    const isDeleted = req.params.action === "delete";
    const offer = await Offer.findByIdAndUpdate(req.params.id, { isDeleted }, { new: true });

    if (!offer) {
      return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Offer not found." });
    }

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: `Offer ${isDeleted ? "deleted" : "restored"} successfully.`,
    });
  } catch (error) {
    next(error);
  }
};
