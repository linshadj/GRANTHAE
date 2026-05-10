import { Rental } from "../../models/rentalDb.js";
import { Category } from "../../models/categoryDb.js";
import userDb from "../../models/userDb.js";


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

    if (search) {
        filter.$or = [
            { bookTitle: { $regex: search, $options: 'i' } },
            { author: { $regex: search, $options: 'i' } }
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
