import { Rental } from "../../models/rentalDb.js";
import { Category } from "../../models/categoryDb.js";
import rentalOrderDb from "../../models/rentalOrderDb.js";
import "../../models/userDb.js";
import { creditWallet, debitWallet } from "./walletService.js";
import { normalizeSearchTerm, safeContainsRegex } from "../../utils/search.js";

const roundCurrency = (amount) => Math.round((Number(amount || 0) + Number.EPSILON) * 100) / 100;

const createRentalCode = () => `RNT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const addDays = (date, days) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + Number(days));
    return nextDate;
};

export const createRentalRequest = async (rentalData) => {
    const requiredTextFields = ["owner", "bookTitle", "author", "description", "category", "bookCondition"];
    for (const field of requiredTextFields) {
        if (!String(rentalData[field] || "").trim()) {
            throw new Error("Please fill all required listing details.");
        }
    }

    const category = await Category.findOne({
        _id: rentalData.category,
        isDeleted: false,
        isBlocked: false,
    });
    if (!category) {
        throw new Error("Select a valid category.");
    }

    if (!Array.isArray(rentalData.images) || rentalData.images.length < 3) {
        throw new Error("A minimum of 3 images are required.");
    }
    if (!Number.isFinite(Number(rentalData.dailyRate)) || Number(rentalData.dailyRate) <= 0) {
        throw new Error("Daily rate must be greater than zero.");
    }
    if (!Number.isFinite(Number(rentalData.minRentalDays)) || Number(rentalData.minRentalDays) < 1) {
        throw new Error("Minimum rental days must be at least 1.");
    }
    if (!Number.isFinite(Number(rentalData.depositAmount)) || Number(rentalData.depositAmount) < 0) {
        throw new Error("Deposit amount cannot be negative.");
    }

    const newRental = new Rental(rentalData);
    return await newRental.save();
};

export const getRentalRequestsByUser = async (userId) => {
    return await Rental.find({ owner: userId }).sort({ createdAt: -1 });
};

export const getApprovedRentals = async (query = {}) => {
    const { search, category, page = 1, limit = 12 } = query;
    const filter = {
        status: "Available",
        isBlocked: false,
        isDeleted: false
    };

    if (category) {
        filter.category = category;
    }

    const normalizedSearch = normalizeSearchTerm(search);
    if (normalizedSearch) {
        filter.$or = [
            { bookTitle: safeContainsRegex(normalizedSearch) },
            { author: safeContainsRegex(normalizedSearch) }
        ];
    }

    const skip = (page - 1) * limit;
    const total = await Rental.countDocuments(filter);
    const rentals = await Rental.find(filter)
        .populate('category')
        .populate('owner', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    return {
        rentals,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page)
    };
};

export const getRentalById = async (id) => {
    return await Rental.findById(id).populate('category').populate('owner', 'firstName lastName');
};

export const getRelatedRentals = async (categoryId, excludeRentalId) => {
    if (!categoryId) return [];

    return Rental.find({
        category: categoryId,
        _id: { $ne: excludeRentalId },
        status: "Available",
        isBlocked: false,
        isDeleted: false
    })
        .populate("category")
        .populate("owner", "firstName lastName")
        .sort({ createdAt: -1 })
        .limit(4);
};

export const requestRental = async (userId, rentalId, data = {}) => {
    const rental = await Rental.findOne({
        _id: rentalId,
        isDeleted: false,
        isBlocked: false
    }).populate("owner", "firstName lastName");

    if (!rental) throw new Error("Rental book not found.");
    if (rental.owner._id.toString() === userId.toString()) {
        throw new Error("You cannot rent your own listed book.");
    }
    if (rental.status !== "Available") {
        throw new Error("This rental book is not available right now.");
    }

    const existingOpenRequest = await rentalOrderDb.findOne({
        rental: rental._id,
        renter: userId,
        status: { $in: ["Requested", "Active", "Return Requested"] }
    });
    if (existingOpenRequest) {
        throw new Error("You already have an open request for this book.");
    }

    const durationDays = Math.max(
        Number(rental.minRentalDays || 1),
        Math.floor(Number(data.durationDays || data.duration || rental.minRentalDays || 1))
    );
    if (!Number.isFinite(durationDays) || durationDays < 1) {
        throw new Error("Select a valid rental duration.");
    }

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(startDate.getTime()) || startDate < today) {
        throw new Error("Select a valid start date.");
    }

    const rentalCharge = roundCurrency(Number(rental.dailyRate || 0) * durationDays);
    const depositAmount = roundCurrency(rental.depositAmount || 0);
    const totalAmount = roundCurrency(rentalCharge + depositAmount);

    const rentalOrder = new rentalOrderDb({
        rental: rental._id,
        renter: userId,
        owner: rental.owner._id,
        rentalCode: createRentalCode(),
        startDate,
        endDate: addDays(startDate, durationDays),
        durationDays,
        dailyRate: rental.dailyRate,
        rentalCharge,
        depositAmount,
        totalAmount,
        status: "Requested",
        paymentStatus: "Pending",
        requestedAt: new Date()
    });

    await rentalOrder.save();
    return rentalOrder;
};

export const confirmRentalRequest = async (ownerId, rentalOrderId) => {
    const rentalOrder = await getRentalOrderForOwner(ownerId, rentalOrderId);

    if (rentalOrder.status !== "Requested") {
        throw new Error("Only pending rental requests can be confirmed.");
    }

    const rental = rentalOrder.rental;
    if (!rental || rental.isDeleted || rental.isBlocked || rental.status !== "Available") {
        throw new Error("This rental book is not available for confirmation.");
    }

    await debitWallet(
        rentalOrder.renter._id,
        rentalOrder.totalAmount,
        `Rental payment for ${rental.bookTitle}`,
        "rental_payment",
        rentalOrder._id.toString()
    );

    if (Number(rentalOrder.rentalCharge || 0) > 0) {
        await creditWallet(
            ownerId,
            rentalOrder.rentalCharge,
            `Rental income for ${rental.bookTitle}`,
            "rental_income",
            rentalOrder._id.toString()
        );
    }

    const confirmedAt = new Date();
    rental.status = "Rented";
    rentalOrder.status = "Active";
    rentalOrder.paymentStatus = "Paid";
    rentalOrder.confirmedAt = confirmedAt;

    await Promise.all([
        rental.save(),
        rentalOrder.save(),
        rentalOrderDb.updateMany(
            {
                _id: { $ne: rentalOrder._id },
                rental: rental._id,
                status: "Requested"
            },
            {
                $set: {
                    status: "Rejected",
                    paymentStatus: "Cancelled",
                    rejectedAt: confirmedAt,
                    rejectionReason: "Another request for this book was confirmed."
                }
            }
        )
    ]);

    return rentalOrder;
};

export const rejectRentalRequest = async (ownerId, rentalOrderId, reason = "") => {
    const rentalOrder = await getRentalOrderForOwner(ownerId, rentalOrderId);

    if (rentalOrder.status !== "Requested") {
        throw new Error("Only pending rental requests can be declined.");
    }

    rentalOrder.status = "Rejected";
    rentalOrder.paymentStatus = "Cancelled";
    rentalOrder.rejectedAt = new Date();
    rentalOrder.rejectionReason = String(reason || "").trim() || "Declined by owner.";
    await rentalOrder.save();

    return rentalOrder;
};

export const getRentalOrderForRenter = async (userId, rentalOrderId) => {
    const rentalOrder = await rentalOrderDb.findOne({ _id: rentalOrderId, renter: userId })
        .populate({
            path: "rental",
            populate: { path: "category" }
        })
        .populate("owner", "firstName lastName email")
        .populate("renter", "firstName lastName email");

    if (!rentalOrder) throw new Error("Rental record not found.");
    return rentalOrder;
};

export const getRentalOrderForOwner = async (userId, rentalOrderId) => {
    const rentalOrder = await rentalOrderDb.findOne({ _id: rentalOrderId, owner: userId })
        .populate("rental")
        .populate("renter", "firstName lastName email")
        .populate("owner", "firstName lastName email");

    if (!rentalOrder) throw new Error("Rental record not found.");
    return rentalOrder;
};

export const getRentalsByRenter = async (userId, searchQuery = "") => {
    const filter = { renter: userId };
    let rentalFilter = null;

    const normalizedSearch = normalizeSearchTerm(searchQuery);
    if (normalizedSearch) {
        rentalFilter = {
            $or: [
                { bookTitle: safeContainsRegex(normalizedSearch) },
                { author: safeContainsRegex(normalizedSearch) }
            ]
        };
    }

    const rentalOrders = await rentalOrderDb.find(filter)
        .populate({
            path: "rental",
            match: rentalFilter,
            populate: { path: "category" }
        })
        .populate("owner", "firstName lastName email")
        .sort({ createdAt: -1 });

    return rentalOrders.filter((rentalOrder) => rentalOrder.rental);
};

export const getRenterOrdersForOrdersPage = async (userId, filters = {}) => {
    const {
        search = "",
        status = "all",
        startDate = "",
        endDate = "",
        sort = "newest",
        page = 1,
        limit = 8
    } = filters;

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 25);
    const query = { renter: userId };

    if (status && status !== "all") {
        query.status = status;
    }

    const createdAt = {};
    if (startDate) {
        const parsedStartDate = new Date(startDate);
        if (!Number.isNaN(parsedStartDate.getTime())) {
            parsedStartDate.setHours(0, 0, 0, 0);
            createdAt.$gte = parsedStartDate;
        }
    }
    if (endDate) {
        const parsedEndDate = new Date(endDate);
        if (!Number.isNaN(parsedEndDate.getTime())) {
            parsedEndDate.setHours(23, 59, 59, 999);
            createdAt.$lte = parsedEndDate;
        }
    }
    if (Object.keys(createdAt).length > 0) {
        query.createdAt = createdAt;
    }

    const sortOptions = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        price_desc: { totalAmount: -1 },
        price_asc: { totalAmount: 1 }
    };

    const normalizedSearch = normalizeSearchTerm(search);
    const searchMatch = normalizedSearch
        ? {
            $or: [
                { rentalCode: safeContainsRegex(normalizedSearch) },
                { "rental.bookTitle": safeContainsRegex(normalizedSearch) },
                { "rental.author": safeContainsRegex(normalizedSearch) }
            ]
        }
        : null;

    const [result = {}] = await rentalOrderDb.aggregate([
        { $match: query },
        {
            $lookup: {
                from: Rental.collection.name,
                localField: "rental",
                foreignField: "_id",
                as: "rental"
            }
        },
        { $unwind: "$rental" },
        ...(searchMatch ? [{ $match: searchMatch }] : []),
        {
            $facet: {
                rentalOrders: [
                    { $sort: sortOptions[sort] || sortOptions.newest },
                    { $skip: (currentPage - 1) * pageLimit },
                    { $limit: pageLimit }
                ],
                meta: [{ $count: "total" }]
            }
        }
    ]).collation({ locale: "en", strength: 2 });

    const rentalOrders = result.rentalOrders || [];
    await rentalOrderDb.populate(rentalOrders, { path: "owner", select: "firstName lastName email" });

    const total = result.meta?.[0]?.total || 0;

    return {
        rentalOrders,
        total,
        totalPages: Math.max(Math.ceil(total / pageLimit), 1),
        currentPage,
        limit: pageLimit
    };
};

export const getIncomingRentalOrders = async (ownerId) => {
    return rentalOrderDb.find({ owner: ownerId })
        .populate("rental")
        .populate("renter", "firstName lastName email")
        .sort({ createdAt: -1 });
};

export const getRentalIncomeByListing = async (ownerId) => {
    const rows = await rentalOrderDb.aggregate([
        {
            $match: {
                owner: ownerId,
                status: { $in: ["Active", "Return Requested", "Returned"] }
            }
        },
        {
            $group: {
                _id: "$rental",
                totalIncome: { $sum: "$rentalCharge" },
                rentalCount: { $sum: 1 }
            }
        }
    ]);

    return rows.reduce((acc, row) => {
        acc[row._id.toString()] = {
            totalIncome: row.totalIncome || 0,
            rentalCount: row.rentalCount || 0
        };
        return acc;
    }, {});
};

export const requestRentalReturn = async (userId, rentalOrderId, data = {}) => {
    const rentalOrder = await rentalOrderDb.findOne({ _id: rentalOrderId, renter: userId }).populate("rental");
    if (!rentalOrder) throw new Error("Rental record not found.");
    if (rentalOrder.status !== "Active") {
        throw new Error("Only active rentals can be returned.");
    }

    const returnCondition = String(data.returnCondition || "").trim();
    const returnTrackingId = String(data.returnTrackingId || "").trim();
    const returnComments = String(data.returnComments || "").trim();

    if (!["Excellent", "Good", "Fair", "Damaged"].includes(returnCondition)) {
        throw new Error("Select the book condition.");
    }
    if (!returnTrackingId) {
        throw new Error("Courier tracking ID is required.");
    }

    rentalOrder.status = "Return Requested";
    rentalOrder.returnCondition = returnCondition;
    rentalOrder.returnTrackingId = returnTrackingId;
    rentalOrder.returnComments = returnComments;
    rentalOrder.returnRequestedAt = new Date();

    await rentalOrder.save();
    return rentalOrder;
};

export const completeRentalReturn = async (ownerId, rentalOrderId) => {
    const rentalOrder = await getRentalOrderForOwner(ownerId, rentalOrderId);

    if (rentalOrder.status !== "Return Requested") {
        throw new Error("Only pending rental returns can be completed.");
    }

    if (Number(rentalOrder.depositAmount || 0) > 0 && !rentalOrder.depositRefundedAt) {
        await creditWallet(
            rentalOrder.renter._id,
            rentalOrder.depositAmount,
            `Security deposit refund for rental ${rentalOrder.rentalCode}`,
            "rental_refund",
            rentalOrder._id.toString()
        );
        rentalOrder.depositRefundedAt = new Date();
        rentalOrder.paymentStatus = "Deposit Refunded";
    }

    rentalOrder.status = "Returned";
    rentalOrder.returnedAt = new Date();

    if (rentalOrder.rental) {
        await Rental.updateOne(
            { _id: rentalOrder.rental._id, status: "Rented" },
            { $set: { status: "Available" } }
        );
    }

    await rentalOrder.save();
    return rentalOrder;
};

export const updateRentalListing = async (userId, rentalId, data = {}) => {
    const rental = await Rental.findOne({ _id: rentalId, owner: userId, isDeleted: false });
    if (!rental) throw new Error("Rental listing not found.");
    if (rental.status === "Rented") {
        throw new Error("A rented listing cannot be edited until it is returned.");
    }

    const category = await Category.findOne({ _id: data.category, isDeleted: false, isBlocked: false });
    if (!category) throw new Error("Select a valid category.");

    const dailyRate = Number(data.dailyRate);
    const minRentalDays = Number(data.minRentalDays);
    const depositAmount = Number(data.depositAmount);

    if (!String(data.bookTitle || "").trim() || !String(data.author || "").trim() || !String(data.description || "").trim()) {
        throw new Error("Please fill all required listing details.");
    }
    if (!Array.isArray(data.images) || data.images.length < 3) {
        throw new Error("A minimum of 3 images are required.");
    }
    if (!Number.isFinite(dailyRate) || dailyRate <= 0) throw new Error("Daily rate must be greater than zero.");
    if (!Number.isFinite(minRentalDays) || minRentalDays < 1) throw new Error("Minimum rental days must be at least 1.");
    if (!Number.isFinite(depositAmount) || depositAmount < 0) throw new Error("Deposit amount cannot be negative.");

    rental.bookTitle = data.bookTitle.trim();
    rental.author = data.author.trim();
    rental.isbn = String(data.isbn || "").trim();
    rental.category = data.category;
    rental.description = data.description.trim();
    rental.dailyRate = dailyRate;
    rental.bookCondition = data.bookCondition;
    rental.minRentalDays = minRentalDays;
    rental.depositAmount = depositAmount;
    rental.images = data.images;
    rental.coverImage = data.coverImage || data.images[0] || "";

    if (rental.status === "Rejected") {
        rental.status = "Pending";
        rental.rejectionReason = "";
    }

    await rental.save();
    return rental;
};

export const toggleRentalAvailability = async (userId, rentalId) => {
    const rental = await Rental.findOne({ _id: rentalId, owner: userId, isDeleted: false });
    if (!rental) throw new Error("Rental listing not found.");
    if (rental.status === "Rented") {
        throw new Error("A currently rented book cannot be disabled.");
    }
    if (!["Available", "Approved", "Hidden"].includes(rental.status)) {
        throw new Error("Only live listings can be disabled or enabled.");
    }

    rental.status = rental.status === "Hidden" ? "Available" : "Hidden";
    await rental.save();
    return rental;
};
