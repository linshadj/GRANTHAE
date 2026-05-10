import { Category } from "../../models/categoryDb.js";
import { Rental } from "../../models/rentalDb.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

import * as rentalService from "../../service/user/rentalService.js";
import * as walletService from "../../service/user/walletService.js";
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

        res.render('pages/rental-details', {
            layout: 'layouts/main',
            title: rental.bookTitle,
            rental,
            wallet,
            isLoggedIn: Boolean(userId),
            user: currentUser,
            path: '/rental-place'
        });
    } catch (error) {
        next(error);
    }
};

export const getMyListingsPage = async (req, res, next) => {
    try {
        const userId = req.user?._id || req.session.user;
        const listings = await Rental.find({ owner: userId, isDeleted: false })
            .populate('category')
            .sort({ createdAt: -1 });

        res.render('pages/my-listings', {
            layout: 'layouts/user-panel',
            title: 'My Listings',
            listings,
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

        // Renter request records are not modeled yet; keep this page wired for that collection.
        const incomingRequests = [];

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
