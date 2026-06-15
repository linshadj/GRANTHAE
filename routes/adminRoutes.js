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
import { adminWriteLimiter, authLimiter } from "../middlewares/securityMiddleware.js";
import { addCoupon, couponsPage, editCoupon, getAddCouponPage, getEditCouponPage, toggleCouponStatus } from "../controller/admin/couponController.js";
import { addOffer, editOffer, getAddOfferPage, getEditOfferPage, offersPage, toggleOfferStatus } from "../controller/admin/offerController.js";
import { downloadSalesReport, reportsPage } from "../controller/admin/reportController.js";

const router = express.Router();

router.get("/", (req, res) => {
  return res.redirect("/admin/login");
});

router.route("/login")
    .get(ifAdmin, adminLoginPage)
    .post(authLimiter, ifAdmin, adminLoginHandler);

router.get("/dashboard", isAdmin, adminDashboardPage);

router.route("/users")
    .get(isAdmin, usersPage)
    .post(isAdmin, adminLoginHandler);

router.patch("/users/toggle-block/:id/:action", isAdmin, adminWriteLimiter, toggleBlockUser);
router.get("/users/view/:id", isAdmin, viewUserDetail);

router.get("/users/live", isAdmin, liveUsersSearch);

// Categories
router.get("/categories", isAdmin, categoriesPage);
router.get("/categories/add", isAdmin, getAddCategoryPage);
router.post("/categories/add", isAdmin, adminWriteLimiter, uploadCategory.single("coverImage"), addCategory);
router.get("/categories/edit/:id", isAdmin, getEditCategoryPage);
router.post("/categories/edit/:id", isAdmin, adminWriteLimiter, uploadCategory.single("coverImage"), editCategory);
router.patch("/categories/toggle-status/:id/:action", isAdmin, adminWriteLimiter, toggleCategoryStatus);
router.get("/categories/live", isAdmin, liveCategoriesSearch);

// Offers
router.get("/offers", isAdmin, offersPage);
router.get("/offers/add", isAdmin, getAddOfferPage);
router.post("/offers/add", isAdmin, adminWriteLimiter, addOffer);
router.get("/offers/edit/:id", isAdmin, getEditOfferPage);
router.post("/offers/edit/:id", isAdmin, adminWriteLimiter, editOffer);
router.patch("/offers/toggle-status/:id/:action", isAdmin, adminWriteLimiter, toggleOfferStatus);

// Coupons
router.get("/coupons", isAdmin, couponsPage);
router.get("/coupons/add", isAdmin, getAddCouponPage);
router.post("/coupons/add", isAdmin, adminWriteLimiter, addCoupon);
router.get("/coupons/edit/:id", isAdmin, getEditCouponPage);
router.post("/coupons/edit/:id", isAdmin, adminWriteLimiter, editCoupon);
router.patch("/coupons/toggle-status/:id/:action", isAdmin, adminWriteLimiter, toggleCouponStatus);

// Products
router.get("/products", isAdmin, productsPage);
router.get("/products/add", isAdmin, getAddProductPage);
router.post("/products/add", isAdmin, adminWriteLimiter, uploadProduct.array("images", 10), addProduct);
router.get("/products/edit/:id", isAdmin, getEditProductPage);
router.post("/products/edit/:id", isAdmin, adminWriteLimiter, uploadProduct.array("images", 10), editProduct);
router.patch("/products/toggle-status/:id/:action", isAdmin, adminWriteLimiter, toggleProductStatus);
router.get("/products/live", isAdmin, liveProductsSearch);

// Orders
router.get("/orders", isAdmin, ordersPage);
router.get("/orders/view/:id", isAdmin, viewOrderDetail);
router.patch("/orders/update-status/:id", isAdmin, adminWriteLimiter, updateOrderStatus);
router.patch("/orders/:orderId/items/:itemId/return-review", isAdmin, adminWriteLimiter, reviewReturnRequest);
router.get("/orders/live", isAdmin, liveOrdersSearch);

// Inventory
router.get("/inventory", isAdmin, getInventoryPage);
router.patch("/inventory/update-stock/:id", isAdmin, adminWriteLimiter, updateStock);
 
// Rental Requests
router.get("/rental-requests", isAdmin, getRentalRequestsPage);
router.patch("/rental-requests/:id", isAdmin, adminWriteLimiter, handleRentalRequest);

// Reports
router.get("/reports", isAdmin, reportsPage);
router.get("/reports/download/:format", isAdmin, adminWriteLimiter, downloadSalesReport);

router.get("/logout", isAdmin, adminLogoutHandler);


export default router;
