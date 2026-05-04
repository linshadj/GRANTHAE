import { Product } from "../../models/productDb.js";

export const getProductsForInventory = async (page = 1, search = "", sort = "newest", filter = "all") => {
    const limit = 10;
    const skip = (page - 1) * limit;

    let matchQuery = { isDeleted: false };
    if (search) {
        matchQuery.name = { $regex: search, $options: "i" };
    }

    const pipeline = [
        { $match: matchQuery },
        {
            $addFields: {
                totalStock: { $sum: "$variants.stock" }
            }
        }
    ];

    if (filter === "in-stock") {
        pipeline.push({ $match: { totalStock: { $gt: 5 } } });
    } else if (filter === "low-stock") {
        pipeline.push({ $match: { totalStock: { $gt: 0, $lte: 5 } } });
    } else if (filter === "out-of-stock") {
        pipeline.push({ $match: { totalStock: 0 } });
    }

    let sortCriteria = { createdAt: -1 };
    if (sort === "stock-low") sortCriteria = { totalStock: 1 };
    else if (sort === "stock-high") sortCriteria = { totalStock: -1 };
    else if (sort === "newest") sortCriteria = { createdAt: -1 };

    pipeline.push({ $sort: sortCriteria });

    // Count total filtered products
    const filteredProductsCount = await Product.aggregate([...pipeline, { $count: "total" }]);
    const totalProducts = filteredProductsCount.length > 0 ? filteredProductsCount[0].total : 0;
    const totalPages = Math.ceil(totalProducts / limit);

    // Get paginated data
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const products = await Product.aggregate(pipeline);
    
    // Manually populate category since aggregate doesn't do it automatically
    // Alternatively use $lookup, but population is easier to read here
    await Product.populate(products, { path: 'category', select: 'name' });

    // Fetch global stats
    const statsPipeline = [
        { $match: { isDeleted: false } },
        { $addFields: { totalStock: { $sum: "$variants.stock" } } },
        {
            $group: {
                _id: null,
                totalLowStock: {
                    $sum: { $cond: [{ $lte: ["$totalStock", 5] }, 1, 0] }
                },
                totalInStock: {
                    $sum: { $cond: [{ $gt: ["$totalStock", 5] }, 1, 0] }
                }
            }
        }
    ];
    const stats = await Product.aggregate(statsPipeline);
    const totalLowStock = stats.length > 0 ? stats[0].totalLowStock : 0;
    const totalInStock = stats.length > 0 ? stats[0].totalInStock : 0;

    return {
        products,
        totalPages,
        currentPage: page,
        totalProducts,
        totalLowStock,
        totalInStock
    };
};

export const updateProductStock = async (productId, newStock, variantName) => {
    if (newStock < 0) throw new Error("Stock cannot be negative");
    if (!variantName) throw new Error("Variant name is required");
    
    const update = { $set: { "variants.$.stock": newStock } };
    const product = await Product.findOneAndUpdate(
        { _id: productId, "variants.name": variantName },
        update,
        { new: true }
    );
    if (!product) throw new Error("Product or variant not found");
    return product;
};
