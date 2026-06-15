import { Product } from "../../models/productDb.js";
import { Category } from "../../models/categoryDb.js";
import { Review } from "../../models/reviewDb.js";
import { Offer } from "../../models/offerDb.js";
import { applyOfferToProductObject, applyOffersToProductObjects } from "./offerPricingService.js";
import { normalizeSearchTerm, safeContainsRegex } from "../../utils/search.js";

const productReviewFilter = (productId) => ({
    product: productId,
    $or: [{ targetType: "product" }, { targetType: { $exists: false } }]
});

const parsePriceFilter = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const price = Number(value);
    return Number.isFinite(price) && price >= 0 ? price : null;
};

const buildProductSort = (sort) => {
    switch (sort) {
        case "price_asc":
            return { effectivePrice: 1, createdAt: -1, _id: 1 };
        case "price_desc":
            return { effectivePrice: -1, createdAt: -1, _id: 1 };
        case "name_asc":
            return { name: 1, _id: 1 };
        case "name_desc":
            return { name: -1, _id: 1 };
        case "newest":
        default:
            return { createdAt: -1, _id: 1 };
    }
};

const buildPriceMatch = (minPriceValue, maxPriceValue) => {
    const effectivePrice = {};
    if (minPriceValue !== null) effectivePrice.$gte = minPriceValue;
    if (maxPriceValue !== null) effectivePrice.$lte = maxPriceValue;
    return Object.keys(effectivePrice).length ? { effectivePrice } : null;
};

const buildOfferPricingStages = (now = new Date()) => [
    {
        $lookup: {
            from: Offer.collection.name,
            let: {
                productId: "$_id",
                categoryId: "$category",
                productPrice: { $ifNull: ["$price", 0] }
            },
            pipeline: [
                {
                    $match: {
                        isDeleted: false,
                        isActive: true,
                        startDate: { $lte: now },
                        endDate: { $gte: now },
                    }
                },
                {
                    $match: {
                        $expr: {
                            $or: [
                                { $eq: ["$appliesTo", "all"] },
                                {
                                    $and: [
                                        { $eq: ["$appliesTo", "products"] },
                                        { $in: ["$$productId", { $ifNull: ["$products", []] }] }
                                    ]
                                },
                                {
                                    $and: [
                                        { $eq: ["$appliesTo", "categories"] },
                                        { $in: ["$$categoryId", { $ifNull: ["$categories", []] }] }
                                    ]
                                }
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        discountAmount: {
                            $round: [
                                {
                                    $min: [
                                        {
                                            $max: [
                                                {
                                                    $cond: [
                                                        { $eq: ["$discountType", "percentage"] },
                                                        {
                                                            $multiply: [
                                                                "$$productPrice",
                                                                { $divide: [{ $ifNull: ["$discountValue", 0] }, 100] }
                                                            ]
                                                        },
                                                        { $ifNull: ["$discountValue", 0] }
                                                    ]
                                                },
                                                0
                                            ]
                                        },
                                        "$$productPrice"
                                    ]
                                },
                                2
                            ]
                        }
                    }
                },
                { $match: { discountAmount: { $gt: 0 } } },
                {
                    $addFields: {
                        finalPrice: {
                            $round: [{ $subtract: ["$$productPrice", "$discountAmount"] }, 2]
                        }
                    }
                },
                { $sort: { discountAmount: -1, createdAt: -1, _id: 1 } },
                { $limit: 1 },
                {
                    $project: {
                        _id: 0,
                        title: 1,
                        discountType: 1,
                        discountValue: 1,
                        appliesTo: 1,
                        discountAmount: 1,
                        finalPrice: 1
                    }
                }
            ],
            as: "bestOfferCandidates"
        }
    },
    {
        $set: {
            bestOffer: { $arrayElemAt: ["$bestOfferCandidates", 0] }
        }
    },
    {
        $set: {
            originalPrice: { $round: [{ $ifNull: ["$price", 0] }, 2] },
            offerDiscountAmount: { $ifNull: ["$bestOffer.discountAmount", 0] },
            offerPrice: { $ifNull: ["$bestOffer.finalPrice", { $round: [{ $ifNull: ["$price", 0] }, 2] }] },
            effectivePrice: { $ifNull: ["$bestOffer.finalPrice", { $round: [{ $ifNull: ["$price", 0] }, 2] }] },
            hasOffer: { $gt: [{ $ifNull: ["$bestOffer.discountAmount", 0] }, 0] },
            totalStock: { $sum: "$variants.stock" }
        }
    },
    { $project: { bestOfferCandidates: 0 } }
];

const addReviewStats = async (products = []) => {
    if (!products.length) return products;

    const productIds = products.map((product) => product._id);
    const reviewStats = await Review.aggregate([
        {
            $match: {
                product: { $in: productIds },
                $or: [{ targetType: "product" }, { targetType: { $exists: false } }]
            }
        },
        {
            $group: {
                _id: "$product",
                avgRating: { $avg: "$rating" },
                reviewCount: { $sum: 1 }
            }
        }
    ]);

    const statsByProductId = new Map(
        reviewStats.map((stats) => [stats._id.toString(), stats])
    );

    return products.map((product) => {
        const stats = statsByProductId.get(product._id.toString());
        return {
            ...product,
            avgRating: stats ? Number(stats.avgRating.toFixed(1)) : 0,
            reviewCount: stats ? stats.reviewCount : 0,
            totalStock: Number(product.totalStock || 0)
        };
    });
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

    const filter = {
        isBlocked: false,
        isDeleted: false
    };

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
        const activeCategories = await Category.find({ isBlocked: false, isDeleted: false }).select('_id');
        const activeCategoryIds = activeCategories.map(c => c._id);
        filter.category = { $in: activeCategoryIds };
    }

    const normalizedSearch = normalizeSearchTerm(search);
    if (normalizedSearch) {
        filter.$or = [
            { name: safeContainsRegex(normalizedSearch) },
            { author: safeContainsRegex(normalizedSearch) }
        ];
    }

    const minPriceValue = parsePriceFilter(minPrice);
    const maxPriceValue = parsePriceFilter(maxPrice);
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 48);
    const skip = (currentPage - 1) * pageLimit;
    const priceMatch = buildPriceMatch(minPriceValue, maxPriceValue);
    const priceMatchStages = priceMatch ? [{ $match: priceMatch }] : [];

    const [result = {}] = await Product.aggregate([
        { $match: filter },
        ...buildOfferPricingStages(),
        {
            $facet: {
                products: [
                    ...priceMatchStages,
                    { $sort: buildProductSort(sort) },
                    { $skip: skip },
                    { $limit: pageLimit }
                ],
                meta: [
                    ...priceMatchStages,
                    { $count: "total" }
                ],
                priceRange: [
                    {
                        $group: {
                            _id: null,
                            min: { $min: "$effectivePrice" },
                            max: { $max: "$effectivePrice" },
                            hasOfferPrice: {
                                $max: {
                                    $cond: [{ $gt: ["$offerDiscountAmount", 0] }, 1, 0]
                                }
                            }
                        }
                    }
                ]
            }
        }
    ])
        .collation({ locale: "en", strength: 2 })
        .allowDiskUse(true);

    const paginatedProducts = result.products || [];
    await Product.populate(paginatedProducts, { path: 'category' });

    const productsWithRatings = await addReviewStats(paginatedProducts);
    const totalProducts = result.meta?.[0]?.total || 0;
    const rawPriceRange = result.priceRange?.[0];
    const priceRange = rawPriceRange
        ? {
            min: rawPriceRange.min || 0,
            max: rawPriceRange.max || 0,
            hasOfferPrice: Boolean(rawPriceRange.hasOfferPrice)
        }
        : { min: 0, max: 0, hasOfferPrice: false };

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
    const products = pricedProducts.map((product) => ({
        ...product,
        totalStock: product.variants ? product.variants.reduce((acc, variant) => acc + Number(variant.stock || 0), 0) : 0,
        avgRating: product.avgRating || 0,
    }));

    return addReviewStats(products);
};
