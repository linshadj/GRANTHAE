import express from "express";
import { ifAdmin, isAdmin } from "../middlewares/authMiddlewares.js";
import { adminLoginHandler, adminLoginPage, adminLogoutHandler } from "../controller/admin/adminAuthController.js";
import { adminDashboardPage } from "../controller/admin/dashboardController.js";
import { liveUsersSearch, toggleBlockUser, usersPage, viewUserDetail } from "../controller/admin/userController.js";
import { addCategory, categoriesPage, editCategory, getAddCategoryPage, getEditCategoryPage, liveCategoriesSearch, toggleCategoryStatus } from "../controller/admin/categoryController.js";
import { addProduct, editProduct, getAddProductPage, getEditProductPage, liveProductsSearch, productsPage, toggleProductStatus } from "../controller/admin/productController.js";
import { liveOrdersSearch, ordersPage, reviewReturnRequest, updateOrderStatus, viewOrderDetail } from "../controller/admin/orderController.js";
import { getInventoryPage, updateStock } from "../controller/admin/inventoryController.js";
import { getRentalRequestsPage, handleRentalRequest } from "../controller/admin/rentalRequestController.js";
import { uploadCategory, uploadProduct } from "../middlewares/multerUpload.js";
import { addCoupon, couponsPage, editCoupon, getAddCouponPage, getEditCouponPage, toggleCouponStatus } from "../controller/admin/couponController.js";
import { addOffer, editOffer, getAddOfferPage, getEditOfferPage, offersPage, toggleOfferStatus } from "../controller/admin/offerController.js";
import { downloadSalesReport, reportsPage } from "../controller/admin/reportController.js";

const router = express.Router();

router.get("/", (req, res) => {
  return res.redirect("/admin/login");
});

router.route("/login")
    .get(ifAdmin, adminLoginPage)
    .post(ifAdmin, adminLoginHandler);

router.get("/dashboard", isAdmin, adminDashboardPage);

router.route("/users")
    .get(isAdmin, usersPage)
    .post(isAdmin, adminLoginHandler);

router.patch("/users/toggle-block/:id/:action", isAdmin, toggleBlockUser);
router.get("/users/view/:id", isAdmin, viewUserDetail);

router.get("/users/live", liveUsersSearch);

// Categories
router.get("/categories", isAdmin, categoriesPage);
router.get("/categories/add", isAdmin, getAddCategoryPage);
router.post("/categories/add", isAdmin, uploadCategory.single("coverImage"), addCategory);
router.get("/categories/edit/:id", isAdmin, getEditCategoryPage);
router.post("/categories/edit/:id", isAdmin, uploadCategory.single("coverImage"), editCategory);
router.patch("/categories/toggle-status/:id/:action", isAdmin, toggleCategoryStatus);
router.get("/categories/live", isAdmin, liveCategoriesSearch);

// Offers
router.get("/offers", isAdmin, offersPage);
router.get("/offers/add", isAdmin, getAddOfferPage);
router.post("/offers/add", isAdmin, addOffer);
router.get("/offers/edit/:id", isAdmin, getEditOfferPage);
router.post("/offers/edit/:id", isAdmin, editOffer);
router.patch("/offers/toggle-status/:id/:action", isAdmin, toggleOfferStatus);

// Coupons
router.get("/coupons", isAdmin, couponsPage);
router.get("/coupons/add", isAdmin, getAddCouponPage);
router.post("/coupons/add", isAdmin, addCoupon);
router.get("/coupons/edit/:id", isAdmin, getEditCouponPage);
router.post("/coupons/edit/:id", isAdmin, editCoupon);
router.patch("/coupons/toggle-status/:id/:action", isAdmin, toggleCouponStatus);

// Products
router.get("/products", isAdmin, productsPage);
router.get("/products/add", isAdmin, getAddProductPage);
router.post("/products/add", isAdmin, uploadProduct.array("images", 10), addProduct);
router.get("/products/edit/:id", isAdmin, getEditProductPage);
router.post("/products/edit/:id", isAdmin, uploadProduct.array("images", 10), editProduct);
router.patch("/products/toggle-status/:id/:action", isAdmin, toggleProductStatus);
router.get("/products/live", isAdmin, liveProductsSearch);

// Orders
router.get("/orders", isAdmin, ordersPage);
router.get("/orders/view/:id", isAdmin, viewOrderDetail);
router.patch("/orders/update-status/:id", isAdmin, updateOrderStatus);
router.patch("/orders/:orderId/items/:itemId/return-review", isAdmin, reviewReturnRequest);
router.get("/orders/live", isAdmin, liveOrdersSearch);

// Inventory
router.get("/inventory", isAdmin, getInventoryPage);
router.patch("/inventory/update-stock/:id", isAdmin, updateStock);
 
// Rental Requests
router.get("/rental-requests", isAdmin, getRentalRequestsPage);
router.patch("/rental-requests/:id", isAdmin, handleRentalRequest);

// Reports
router.get("/reports", isAdmin, reportsPage);
router.get("/reports/download/:format", isAdmin, downloadSalesReport);

router.get("/logout", isAdmin, adminLogoutHandler);


export default router;
