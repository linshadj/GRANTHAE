import { getFilteredProducts, getProductById, getRelatedProducts } from "../../service/user/shopService.js";
import { Category } from "../../models/categoryDb.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";
import wishlistDb from "../../models/wishlistDb.js";

export const listProducts = async (req, res) => {
    try {
        const query = req.query;
        const { products, totalProducts, totalPages, currentPage } = await getFilteredProducts(query);
        const categories = await Category.find({ isBlocked: false, isDeleted: false });

        let wishlistProductIds = [];
        if (req.user) {
            const wishlist = await wishlistDb.findOne({ user: req.user._id });
            if (wishlist) {
                wishlistProductIds = wishlist.items.map(item => item.product.toString());
            }
        }

        res.render("pages/market-place", {

            title: "Marketplace - GRANTHAE",
            products,
            categories,
            totalProducts,
            totalPages,
            currentPage,
            query, // Pass query back to views for persistence in filters/pagination
            wishlistProductIds
        });
    } catch (error) {
        console.error("Error in listProducts:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).render("pages/error", {
            message: "Something went wrong while loading the shop.",
            error
        });
    }
};

export const productDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await getProductById(id);

        if (!product) {
            // Only redirect if product doesn't exist at all (deleted or wrong ID)
            return res.redirect("/marketplace?message=Product not found");
        }

        const relatedProducts = product.isUnavailable 
            ? [] 
            : await getRelatedProducts(product.category._id, product._id);

        let isInWishlist = false;
        if (req.user) {
            const wishlist = await wishlistDb.findOne({ user: req.user._id, "items.product": id });
            if (wishlist) isInWishlist = true;
        }

        res.render("pages/product-details", {
            title: `${product.name} - GRANTHAE`,
            product,
            relatedProducts,
            isUnavailable: product.isUnavailable,
            isInWishlist
        });
    } catch (error) {
        console.error("Error in productDetails:", error);
        res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).render("pages/error", {
            message: "Something went wrong while loading product details.",
            error
        });
    }
};
