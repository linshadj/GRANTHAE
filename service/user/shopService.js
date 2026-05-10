import { Product } from "../../models/productDb.js";
import { Category } from "../../models/categoryDb.js";
import { Review } from "../../models/reviewDb.js";
import { applyOfferToProductObject, applyOffersToProductObjects } from "./offerPricingService.js";

const productReviewFilter = (productId) => ({
    product: productId,
    $or: [{ targetType: "product" }, { targetType: { $exists: false } }]
});

const parsePriceFilter = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const price = Number(value);
    return Number.isFinite(price) && price >= 0 ? price : null;
};

const getEffectivePrice = (product) => Number(product.effectivePrice ?? product.offerPrice ?? product.price ?? 0);

const getEffectivePriceRange = (products = []) => {
    const prices = products
        .map(getEffectivePrice)
        .filter((price) => Number.isFinite(price));

    if (!prices.length) {
        return { min: 0, max: 0, hasOfferPrice: false };
    }

    return {
        min: Math.min(...prices),
        max: Math.max(...prices),
        hasOfferPrice: products.some((product) => Number(product.offerDiscountAmount || 0) > 0),
    };
};

const sortProducts = (products, sort) => {
    const sortedProducts = [...products];

    switch (sort) {
        case "price_asc":
            return sortedProducts.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
        case "price_desc":
            return sortedProducts.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
        case "name_asc":
            return sortedProducts.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        case "name_desc":
            return sortedProducts.sort((a, b) => String(b.name || "").localeCompare(String(a.name || "")));
        case "newest":
        default:
            return sortedProducts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
};

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
    const requestedCategoryIds = Array.isArray(category)
        ? category.filter(Boolean)
        : category
            ? [category]
            : [];

    if (requestedCategoryIds.length) {
        const selectedCategories = await Category.find({
            _id: { $in: requestedCategoryIds },
            isBlocked: false,
            isDeleted: false
        }).select("_id");
        filter.category = { $in: selectedCategories.map((selectedCategory) => selectedCategory._id) };
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

    const minPriceValue = parsePriceFilter(minPrice);
    const maxPriceValue = parsePriceFilter(maxPrice);
    const currentPage = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.max(Number(limit) || 12, 1);

    const products = await Product.find(filter).populate('category');
    const pricedProducts = await applyOffersToProductObjects(products);
    const priceRange = getEffectivePriceRange(pricedProducts);

    const priceFilteredProducts = pricedProducts.filter((product) => {
        const effectivePrice = getEffectivePrice(product);
        if (minPriceValue !== null && effectivePrice < minPriceValue) return false;
        if (maxPriceValue !== null && effectivePrice > maxPriceValue) return false;
        return true;
    });

    const sortedProducts = sortProducts(priceFilteredProducts, sort);
    const totalProducts = sortedProducts.length;
    const skip = (currentPage - 1) * pageLimit;
    const paginatedProducts = sortedProducts.slice(skip, skip + pageLimit);

    // Calculate ratings for each product (simplified for now, ideally pre-aggregated)
    const productsWithRatings = await Promise.all(paginatedProducts.map(async (product) => {
        const reviews = await Review.find(productReviewFilter(product._id));
        const avgRating = reviews.length > 0 
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : 0;
        const totalStock = product.variants ? product.variants.reduce((acc, v) => acc + v.stock, 0) : 0;
        return {
            ...product,
            avgRating,
            reviewCount: reviews.length,
            totalStock
        };
    }));

    return {
        products: productsWithRatings,
        totalProducts,
        totalPages: Math.ceil(totalProducts / pageLimit),
        currentPage,
        priceRange
    };
};

export const getProductById = async (id) => {
    const product = await Product.findOne({ _id: id, isDeleted: false })
        .populate('category');

    if (!product) return null;

    const isUnavailable = product.isBlocked || (product.category && (product.category.isBlocked || product.category.isDeleted));

    const reviews = await Review.find(productReviewFilter(id)).populate('user', 'firstName lastName');
    const avgRating = reviews.length > 0 
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : 0;

    const totalStock = product.variants ? product.variants.reduce((acc, v) => acc + v.stock, 0) : 0;

    const pricedProduct = await applyOfferToProductObject(product);

    return {
        ...pricedProduct,
        isUnavailable,
        avgRating,
        reviews,
        totalStock
    };
};

export const getRelatedProducts = async (categoryId, excludeProductId) => {
    const relatedProducts = await Product.find({
        category: categoryId,
        _id: { $ne: excludeProductId },
        isBlocked: false,
        isDeleted: false
    })
    .populate('category')
    .limit(4);

    const pricedProducts = await applyOffersToProductObjects(relatedProducts);
    return pricedProducts.map((product) => ({
        ...product,
        totalStock: product.variants ? product.variants.reduce((acc, variant) => acc + Number(variant.stock || 0), 0) : 0,
        avgRating: product.avgRating || 0,
    }));
};
