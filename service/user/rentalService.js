import { Rental } from "../../models/rentalDb.js";
import { Category } from "../../models/categoryDb.js";
import userDb from "../../models/userDb.js";


export const createRentalRequest = async (rentalData) => {
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
