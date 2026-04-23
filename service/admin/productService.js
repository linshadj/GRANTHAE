import { Product } from "../../models/productDb.js";

export const getProductsForInventory = async (page = 1, search = "", sort = "newest", filter = "all") => {
    const limit = 10;
    const skip = (page - 1) * limit;

    let query = { isDeleted: false };
    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    if (filter === "in-stock") {
        query.stock = { $gt: 5 };
    } else if (filter === "low-stock") {
        query.stock = { $gt: 0, $lte: 5 };
    } else if (filter === "out-of-stock") {
        query.stock = 0;
    }

    let sortCriteria = { createdAt: -1 };
    if (sort === "stock-low") sortCriteria = { stock: 1 };
    else if (sort === "stock-high") sortCriteria = { stock: -1 };

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
        .populate('category', 'name')
        .sort(sortCriteria)
        .skip(skip)
        .limit(limit);

    return {
        products,
        totalPages,
        currentPage: page,
        totalProducts
    };
};

export const updateProductStock = async (productId, newStock) => {
    if (newStock < 0) throw new Error("Stock cannot be negative");
    
    const product = await Product.findByIdAndUpdate(productId, { stock: newStock }, { new: true });
    if (!product) throw new Error("Product not found");
    return product;
};
