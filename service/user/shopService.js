import { Product } from "../../models/productDb.js";
import { Category } from "../../models/categoryDb.js";
import { Review } from "../../models/reviewDb.js";

export const getFilteredProducts = async (query) => {
    const {
        search,
        category,
        minPrice,
        maxPrice,
        sort,
        page = 1,
        limit = 12
    } = query;

    // Build the filter object
    const filter = {
        isBlocked: false,
        isDeleted: false
    };

    // 1. Category Filter (and ensure category is not blocked)
    const activeCategories = await Category.find({ isBlocked: false, isDeleted: false }).select('_id');
    const activeCategoryIds = activeCategories.map(c => c._id);

    if (category) {
        // If specific category requested, check if it's active
        const selectedCategory = await Category.findOne({ _id: category, isBlocked: false, isDeleted: false });
        if (selectedCategory) {
            filter.category = category;
        } else {
            // If requested category is blocked, return no results or handle as needed
            // For now, only show from active categories
            filter.category = { $in: activeCategoryIds };
        }
    } else {
        filter.category = { $in: activeCategoryIds };
    }

    // 2. Search Filter (by name or author)
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { author: { $regex: search, $options: 'i' } }
        ];
    }

    // 3. Price Filter
    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    // 4. Sorting
    let sortOptions = { createdAt: -1 }; // Default sort: New Arrival
    if (sort) {
        switch (sort) {
            case 'price_asc':
                sortOptions = { price: 1 };
                break;
            case 'price_desc':
                sortOptions = { price: -1 };
                break;
            case 'name_asc':
                sortOptions = { name: 1 };
                break;
            case 'name_desc':
                sortOptions = { name: -1 };
                break;
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
        }
    }

    // 5. Pagination
    const skip = (page - 1) * limit;
    const totalProducts = await Product.countDocuments(filter);
    const products = await Product.find(filter)
        .populate('category')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit));

    // Calculate ratings for each product (simplified for now, ideally pre-aggregated)
    const productsWithRatings = await Promise.all(products.map(async (product) => {
        const reviews = await Review.find({ product: product._id });
        const avgRating = reviews.length > 0 
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : 0;
        return {
            ...product.toObject(),
            avgRating,
            reviewCount: reviews.length
        };
    }));

    return {
        products: productsWithRatings,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
        currentPage: Number(page)
    };
};

export const getProductById = async (id) => {
    const product = await Product.findOne({ _id: id, isDeleted: false })
        .populate('category');

    if (!product) return null;

    const isUnavailable = product.isBlocked || (product.category && (product.category.isBlocked || product.category.isDeleted));

    const reviews = await Review.find({ product: id }).populate('user', 'firstName lastName');
    const avgRating = reviews.length > 0 
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 0;

    return {
        ...product.toObject(),
        isUnavailable,
        avgRating,
        reviews
    };
};

export const getRelatedProducts = async (categoryId, excludeProductId) => {
    return await Product.find({
        category: categoryId,
        _id: { $ne: excludeProductId },
        isBlocked: false,
        isDeleted: false
    })
    .limit(4);
};
