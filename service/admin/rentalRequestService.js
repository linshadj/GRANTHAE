import { Rental } from "../../models/rentalDb.js";
import userDb from "../../models/userDb.js";


export const getAllRentalRequests = async (query = {}) => {
    const { status, page = 1, limit = 10 } = query;
    const filter = { isDeleted: false };
    
    if (status) {
        filter.status = status;
    } else {
        filter.status = { $in: ["Pending", "Approved", "Rejected"] };
    }

    const skip = (page - 1) * limit;
    const total = await Rental.countDocuments(filter);
    const requests = await Rental.find(filter)
        .populate('owner', 'firstName lastName email')
        .populate('category', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    return {
        requests,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page)
    };
};

export const updateRentalStatus = async (id, status, rejectionReason = "") => {
    const update = { status };
    if (status === "Approved") {
        update.status = "Available"; // Once approved, it's available for rent
    }
    if (rejectionReason) {
        update.rejectionReason = rejectionReason;
    }
    return await Rental.findByIdAndUpdate(id, update, { new: true });
};
