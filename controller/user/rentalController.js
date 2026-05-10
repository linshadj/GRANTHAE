import { Category } from "../../models/categoryDb.js";
import { Rental } from "../../models/rentalDb.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

import * as rentalService from "../../service/user/rentalService.js";
import * as walletService from "../../service/user/walletService.js";
import * as reviewService from "../../service/user/reviewService.js";
import { deleteCloudinaryUploads, uploadImagesToCloudinary } from "../../utils/cloudinaryUploader.js";

export const getListRentalBookPage = async (req, res, next) => {
    try {
        const categories = await Category.find({ isDeleted: false, isBlocked: false });
        res.render('pages/list-rental-book', {
            layout: 'layouts/user-panel',
            title: 'List a Book for Rental',
            categories,
            user: req.user,
            path: '/list-rental-book'
        });
    } catch (error) {
        next(error);
    }
};

export const submitRentalListing = async (req, res, next) => {
    let uploadedImages = [];

    try {
        const { 
            bookTitle, author, isbn, description, 
            category, dailyRate, bookCondition, 
            minRentalDays, depositAmount, coverImageIndex 
        } = req.body;

        if (!req.files || req.files.length < 3) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ 
                success: false, 
                message: "A minimum of 3 images are required." 
            });
        }

        const userId = req.user?._id || req.session.user;
        uploadedImages = await uploadImagesToCloudinary(req.files, "rentals");
        const images = uploadedImages.map(image => image.url);
        
        let coverImage = "";
        const idx = parseInt(coverImageIndex);
        if (!isNaN(idx) && idx >= 0 && idx < images.length) {
            coverImage = images[idx];
        } else if (images.length > 0) {
            coverImage = images[0];
        }

        const rentalData = {
            owner: userId,
            bookTitle,
            author,
            isbn,
            description,
            category,
            dailyRate: parseFloat(dailyRate),
            bookCondition,
            minRentalDays: parseInt(minRentalDays),
            depositAmount: parseFloat(depositAmount),
            images,
            coverImage,
            status: "Pending"
        };

        await rentalService.createRentalRequest(rentalData);

        res.status(STATUS_CODES.CREATED).json({ 
            success: true, 
            message: "Listing request submitted successfully. It will be live once approved by admin.", 
            redirectUrl: "/profile/my-listings"
        });
    } catch (error) {
        await deleteCloudinaryUploads(uploadedImages);
        console.error("Submit Rental Listing Error:", error);
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not submit rental listing."
        });
    }
};

export const rentalPlacePage = async (req, res, next) => {
    try {
        const result = await rentalService.getApprovedRentals(req.query);
        const categories = await Category.find({ isDeleted: false, isBlocked: false });
        const currentUser = req.user || res.locals.user || null;
        
        res.render('pages/rental-place', {
            layout: 'layouts/main',
            title: 'Rentalplace',

            rentals: result.rentals,
            total: result.total,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            categories,
            user: currentUser,
            path: '/rental-place',
            query: req.query
        });
    } catch (error) {
        next(error);
    }
};

export const rentalDetailsPage = async (req, res, next) => {
    try {
        const rental = await rentalService.getRentalById(req.params.id);
        if (!rental) {
            return res.redirect('/rental-place');
        }

        const userId = req.user?._id || req.session?.user;
        const wallet = userId ? await walletService.getWallet(userId) : null;
        const currentUser = req.user || res.locals.user || null;
        const isOwner = Boolean(userId && rental.owner?._id?.toString() === userId.toString());
        const [relatedRentals, reviewMeta] = await Promise.all([
            rentalService.getRelatedRentals(rental.category?._id, rental._id),
            reviewService.getRentalReviewMeta(rental._id, userId, isOwner)
        ]);

        res.render('pages/rental-details', {
            layout: 'layouts/main',
            title: rental.bookTitle,
            rental,
            wallet,
            isLoggedIn: Boolean(userId),
            isOwner,
            relatedRentals,
            reviewMeta,
            user: currentUser,
            path: '/rental-place'
        });
    } catch (error) {
        next(error);
    }
};

export const requestRentalBook = async (req, res) => {
    try {
        const userId = req.user?._id || req.session.user;
        const { rentalId } = req.params;
        const rentalOrder = await rentalService.requestRental(userId, rentalId, req.body);

        res.status(STATUS_CODES.CREATED).json({
            success: true,
            message: "Rental request sent to the owner.",
            redirectUrl: `/rentals/${rentalOrder._id}/confirmed`
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not request this rental."
        });
    }
};

export const rentalConfirmedPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const rentalOrder = await rentalService.getRentalOrderForRenter(userId, req.params.rentalOrderId);

        res.render("pages/rental-confirmed", {
            layout: "layouts/user-panel",
            title: "Rental Confirmed",
            rentalOrder,
            path: "/profile/rentals"
        });
    } catch (error) {
        next(error);
    }
};

export const getMyRentalsPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const searchQuery = req.query.search || "";
        const rentalOrders = await rentalService.getRentalsByRenter(userId, searchQuery);

        res.render("pages/my-rentals", {
            layout: "layouts/user-panel",
            title: "My Rentals",
            rentalOrders,
            searchQuery,
            path: "/profile/rentals"
        });
    } catch (error) {
        next(error);
    }
};

export const getRentalReturnPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const rentalOrder = await rentalService.getRentalOrderForRenter(userId, req.params.rentalOrderId);

        res.render("pages/rental-return", {
            layout: "layouts/user-panel",
            title: "Return Rental",
            rentalOrder,
            path: "/profile/rentals"
        });
    } catch (error) {
        next(error);
    }
};

export const submitRentalReturn = async (req, res) => {
    try {
        const userId = req.user?._id || req.session.user;
        const rentalOrder = await rentalService.requestRentalReturn(userId, req.params.rentalOrderId, req.body);

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: "Rental return submitted.",
            redirectUrl: `/profile/rentals/${rentalOrder._id}/return/success`
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not submit rental return."
        });
    }
};

export const rentalReturnSuccessPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const rentalOrder = await rentalService.getRentalOrderForRenter(userId, req.params.rentalOrderId);

        res.render("pages/rental-return-success", {
            layout: "layouts/user-panel",
            title: "Rental Return Submitted",
            rentalOrder,
            path: "/profile/rentals"
        });
    } catch (error) {
        next(error);
    }
};

export const getMyListingsPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const [listings, listingIncomeMap] = await Promise.all([
            Rental.find({ owner: userId, isDeleted: false })
                .populate('category')
                .sort({ createdAt: -1 }),
            rentalService.getRentalIncomeByListing(userId)
        ]);

        res.render('pages/my-listings', {
            layout: 'layouts/user-panel',
            title: 'My Listings',
            listings,
            listingIncomeMap,
            path: '/profile/my-listings'
        });
    } catch (error) {
        next(error);
    }
};

export const getRentalRequestsPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const listings = await Rental.find({ owner: userId, isDeleted: false })
            .populate('category')
            .sort({ createdAt: -1 });

        const availableListings = listings.filter((listing) =>
            ["Available", "Approved"].includes(listing.status)
        );

        const incomingRequests = await rentalService.getIncomingRentalOrders(userId);

        res.render('pages/rental-requests', {
            layout: 'layouts/user-panel',
            title: 'Incoming Rental Requests',
            listings,
            availableListings,
            incomingRequests,
            path: '/profile/my-listings/rental-requests'
        });
    } catch (error) {
        next(error);
    }
};

export const completeRentalReturn = async (req, res) => {
    try {
        const userId = req.user?._id || req.session.user;
        await rentalService.completeRentalReturn(userId, req.params.rentalOrderId);

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: "Return confirmed and deposit refunded to the renter wallet."
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not complete the return."
        });
    }
};

export const confirmRentalRequest = async (req, res) => {
    try {
        const userId = req.user?._id || req.session.user;
        await rentalService.confirmRentalRequest(userId, req.params.rentalOrderId);

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: "Rental confirmed. Wallet payment captured and the book is now rented."
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not confirm rental request."
        });
    }
};

export const rejectRentalRequest = async (req, res) => {
    try {
        const userId = req.user?._id || req.session.user;
        await rentalService.rejectRentalRequest(userId, req.params.rentalOrderId, req.body.reason);

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: "Rental request declined."
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not decline rental request."
        });
    }
};

export const getEditRentalListingPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const rental = await Rental.findOne({ _id: req.params.id, owner: userId, isDeleted: false }).populate("category");
        if (!rental) {
            return res.status(404).render("pages/error", { title: "Not Found", message: "Rental listing not found." });
        }

        const categories = await Category.find({ isDeleted: false, isBlocked: false });
        res.render("pages/edit-rental-listing", {
            layout: "layouts/user-panel",
            title: "Edit Rental Listing",
            rental,
            categories,
            path: "/profile/my-listings"
        });
    } catch (error) {
        next(error);
    }
};

export const updateRentalListing = async (req, res) => {
    let uploadedImages = [];

    try {
        const userId = req.user?._id || req.session.user;
        let retainedImages = [];

        if (req.body.existingImages) {
            try {
                const parsedImages = JSON.parse(req.body.existingImages);
                retainedImages = Array.isArray(parsedImages)
                    ? parsedImages.filter((image) => typeof image === "string" && image.trim())
                    : [];
            } catch (error) {
                throw new Error("Could not read retained listing images.");
            }
        }

        if (req.files?.length) {
            uploadedImages = await uploadImagesToCloudinary(req.files, "rentals");
        }

        const uploadedUrls = uploadedImages.map((image) => image.url);
        const images = [...retainedImages, ...uploadedUrls];
        const coverImageIndex = Number(req.body.coverImageIndex);
        const coverImage = Number.isInteger(coverImageIndex) && coverImageIndex >= 0 && coverImageIndex < images.length
            ? images[coverImageIndex]
            : images[0] || "";

        await rentalService.updateRentalListing(userId, req.params.id, {
            ...req.body,
            images,
            coverImage
        });

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: "Rental listing updated.",
            redirectUrl: "/profile/my-listings"
        });
    } catch (error) {
        if (uploadedImages.length) {
            await deleteCloudinaryUploads(uploadedImages);
        }

        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not update listing."
        });
    }
};

export const toggleRentalListing = async (req, res) => {
    try {
        const userId = req.user?._id || req.session.user;
        const rental = await rentalService.toggleRentalAvailability(userId, req.params.id);

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: rental.status === "Hidden" ? "Rental listing disabled." : "Rental listing enabled.",
            status: rental.status
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not update listing status."
        });
    }
};

export const submitRentalReview = async (req, res) => {
    try {
        const userId = req.user?._id || req.session.user;
        const rental = await rentalService.getRentalById(req.params.id);
        if (!rental) {
            return res.status(STATUS_CODES.NOT_FOUND).json({ success: false, message: "Rental book not found." });
        }
        if (rental.owner?._id?.toString() === userId.toString()) {
            return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "You cannot review your own rental book." });
        }

        await reviewService.createRentalReview(req.params.id, userId, req.body.rating, req.body.comment);
        res.status(STATUS_CODES.CREATED).json({ success: true, message: "Review submitted." });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message || "Could not submit review."
        });
    }
};
