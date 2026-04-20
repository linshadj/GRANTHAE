import express from "express";
import { ifAdmin, isAdmin } from "../middlewares/authMiddlewares.js";
import { adminLoginHandler, adminLoginPage, adminLogoutHandler } from "../controller/admin/adminAuthController.js";
import { adminDashboardPage } from "../controller/admin/dashboardController.js";
import { liveUsersSearch, toggleBlockUser, usersPage } from "../controller/admin/userController.js";
import { addCategory, categoriesPage, editCategory, getAddCategoryPage, getEditCategoryPage, liveCategoriesSearch, toggleCategoryStatus } from "../controller/admin/categoryController.js";
import { addProduct, editProduct, getAddProductPage, getEditProductPage, liveProductsSearch, productsPage, toggleProductStatus } from "../controller/admin/productController.js";
import multer from "multer";

// Multer setup for Products
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/products");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const uploadProduct = multer({ storage: productStorage });

// Multer setup for Categories
const categoryStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/categories");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const uploadCategory = multer({ storage: categoryStorage });

const router = express.Router();

router.get("/", (req, res) => {
  return res.redirect("/login");
});

router.route("/login")
    .get(ifAdmin, adminLoginPage)
    .post(ifAdmin, adminLoginHandler);

router.get("/dashboard", isAdmin, adminDashboardPage);

router.route("/users")
    .get(isAdmin, usersPage)
    .post(isAdmin, adminLoginHandler);

router.patch("/users/toggle-block/:id/:action", isAdmin, toggleBlockUser);

router.get("/users/live", liveUsersSearch);

// Categories
router.get("/categories", isAdmin, categoriesPage);
router.get("/categories/add", isAdmin, getAddCategoryPage);
router.post("/categories/add", isAdmin, uploadCategory.single("coverImage"), addCategory);
router.get("/categories/edit/:id", isAdmin, getEditCategoryPage);
router.post("/categories/edit/:id", isAdmin, uploadCategory.single("coverImage"), editCategory);
router.patch("/categories/toggle-status/:id/:action", isAdmin, toggleCategoryStatus);
router.get("/categories/live", isAdmin, liveCategoriesSearch);

// Products
router.get("/products", isAdmin, productsPage);
router.get("/products/add", isAdmin, getAddProductPage);
router.post("/products/add", isAdmin, uploadProduct.array("images", 10), addProduct);
router.get("/products/edit/:id", isAdmin, getEditProductPage);
router.post("/products/edit/:id", isAdmin, uploadProduct.array("images", 10), editProduct);
router.patch("/products/toggle-status/:id/:action", isAdmin, toggleProductStatus);
router.get("/products/live", isAdmin, liveProductsSearch);

router.get("/logout", isAdmin, adminLogoutHandler);

export default router;