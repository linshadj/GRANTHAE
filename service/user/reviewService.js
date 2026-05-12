import { Review } from "../../models/reviewDb.js";

const productReviewFilter = (productId) => ({
    product: productId,
    $or: [{ targetType: "product" }, { targetType: { $exists: false } }]
});

const normalizeReviewInput = (rating, comment) => {
    const normalizedRating = Number(rating);
    const normalizedComment = String(comment || "").trim();

    if (!Number.isInteger(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
        throw new Error("Select a rating between 1 and 5.");
    }

    if (normalizedComment.length < 3) {
        throw new Error("Review comment must be at least 3 characters.");
    }

    if (normalizedComment.length > 1000) {
        throw new Error("Review comment must be 1000 characters or less.");
    }

    return { rating: normalizedRating, comment: normalizedComment };
};

export const getProductReviewMeta = async (productId, userId = null) => {
    const reviews = await Review.find(productReviewFilter(productId))
        .populate("user", "firstName lastName")
        .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
        : 0;

    const userReview = userId
        ? reviews.find((review) => review.user?._id?.toString() === userId.toString())
        : null;

    return {
        reviews,
        avgRating,
        reviewCount: reviews.length,
        userReview,
        canReview: Boolean(userId && !userReview)
    };
};

export const getRentalReviewMeta = async (rentalId, userId = null, isOwner = false) => {
    const reviews = await Review.find({ rental: rentalId, targetType: "rental" })
        .populate("user", "firstName lastName")
        .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
        ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
        : 0;

    const userReview = userId
        ? reviews.find((review) => review.user?._id?.toString() === userId.toString())
        : null;

    return {
        reviews,
        avgRating,
        reviewCount: reviews.length,
        userReview,
        canReview: Boolean(userId && !isOwner && !userReview)
    };
};

export const createProductReview = async (productId, userId, rating, comment) => {
    const reviewData = normalizeReviewInput(rating, comment);
    const existingReview = await Review.findOne({ ...productReviewFilter(productId), user: userId });
    if (existingReview) {
        throw new Error("You have already reviewed this book.");
    }

    return Review.create({
        product: productId,
        targetType: "product",
        user: userId,
        ...reviewData
    });
};

export const createRentalReview = async (rentalId, userId, rating, comment) => {
    const reviewData = normalizeReviewInput(rating, comment);
    const existingReview = await Review.findOne({ rental: rentalId, user: userId, targetType: "rental" });
    if (existingReview) {
        throw new Error("You have already reviewed this rental book.");
    }

    return Review.create({
        product: rentalId,
        rental: rentalId,
        targetType: "rental",
        user: userId,
        ...reviewData
    });
};
