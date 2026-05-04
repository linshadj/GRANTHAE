import { getProductsForInventory, updateProductStock } from "../../service/admin/productService.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";

export const getInventoryPage = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || "";
        const sort = req.query.sort || "newest";
        const filter = req.query.filter || "all";

        const inventoryData = await getProductsForInventory(page, search, sort, filter);

        res.render("admin/inventory", {
            layout: "layouts/admin-panel",
            title: "Inventory Management",
            products: inventoryData.products,
            currentPage: inventoryData.currentPage,
            totalPages: inventoryData.totalPages,
            totalProducts: inventoryData.totalProducts,
            totalLowStock: inventoryData.totalLowStock,
            totalInStock: inventoryData.totalInStock,
            searchQuery: search,
            selectedSort: sort,
            selectedFilter: filter,
            path: "/admin/inventory"
        });
    } catch (error) {
        next(error);
    }
};

export const updateStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { stock, variantName } = req.body;

        await updateProductStock(id, parseInt(stock), variantName);

        res.status(STATUS_CODES.OK).json({
            success: true,
            message: "Stock updated successfully"
        });
    } catch (error) {
        res.status(STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: error.message
        });
    }
};
