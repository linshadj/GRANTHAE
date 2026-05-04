import {
  signUp,
  signupData,
  otpPage,
  otpHandler,
  homePage,
  signIn,
  signInData,
  resendOtp,
  forgotPassword,
  forgotPassData,
  setNewPass,
  setNewPassData,
  passwordChanged,
  logout,
} from "../controller/user/authController.js";
import express from "express";
import {
  googleAuth,
  googleAuthCallbackMiddleware,
  googleAuthSuccess,
} from "../controller/user/googleAuthController.js";
import { ifAuth, isAuth, otpVerify, resetPassAuth } from "../middlewares/authMiddlewares.js";
import { addNewAddress, deleteAddress, editAddress, editProfile, setDefaultAddress, viewEditProfile, viewProfile } from "../controller/user/profileController.js";
import { upload } from "../middlewares/multerUpload.js";
import { changeEmail, changePassword, viewSettings } from "../controller/user/settingsController.js";
import { listProducts, productDetails } from "../controller/user/shopController.js";
import { getCartPage, addToCart, updateQuantity, removeFromCart } from "../controller/user/cartController.js";
import { getListRentalBookPage, submitRentalListing, rentalPlacePage, rentalDetailsPage, getMyListingsPage } from "../controller/user/rentalController.js";

import multer from "multer";

// Multer setup for Rentals
const rentalStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/rentals");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});
const uploadRental = multer({ storage: rentalStorage });


const router = express.Router();


router.get("/", (req, res) => {
  res.redirect("/home");
});

router.get("/home", homePage);

// Marketplace
router.get("/marketplace", listProducts);
router.get("/shop", (req, res) => res.redirect("/marketplace"));
router.get("/product/:id", productDetails);

// Rental Place
router.get("/rental-place", rentalPlacePage);
router.get("/rental/:id", rentalDetailsPage);
router.get("/list-rental-book", isAuth, getListRentalBookPage);
router.post("/list-rental-book", isAuth, uploadRental.array("images", 10), submitRentalListing);
router.get("/list-book", (req, res) => res.redirect("/list-rental-book")); // Handle existing Sell link


// Cart
router.get("/cart", isAuth, getCartPage);
router.post("/cart/add", isAuth, addToCart);
router.patch("/cart/update", isAuth, updateQuantity);
router.delete("/cart/remove", isAuth, removeFromCart);

// Checkout
import { getCheckoutPage, placeOrder, orderSuccessPage } from "../controller/user/checkoutController.js";
router.get("/checkout", isAuth, getCheckoutPage);
router.post("/checkout/place-order", isAuth, placeOrder);
router.get("/order-success/:orderId", isAuth, orderSuccessPage);

// Wishlist
import { getWishlistPage, addToWishlist, removeFromWishlist } from "../controller/user/wishlistController.js";
router.get("/wishlist", isAuth, getWishlistPage);
router.post("/wishlist/add", isAuth, addToWishlist);
router.delete("/wishlist/remove", isAuth, removeFromWishlist);

// Sign In
router.route("/sign-in")
  .get(ifAuth, signIn)
  .post(ifAuth, signInData);

// Sign Up
router.route("/sign-up")
  .get(ifAuth, signUp)
  .post(ifAuth, signupData);

// Google Auth
router.get("/auth/google", googleAuth);
router.get("/auth/google/callback", googleAuthCallbackMiddleware, googleAuthSuccess);

// OTP
router.route("/otp")
  .get(otpVerify, otpPage)
  .post(otpVerify, otpHandler);

router.post("/resend-otp", resendOtp);

// Forgot Password
router.route("/forgot-password")
  .get(ifAuth, forgotPassword)
  .post(ifAuth, forgotPassData);

// Reset Password
router.route("/reset-password")
  .get(resetPassAuth, setNewPass)
  .patch(resetPassAuth, setNewPassData);

router.get("/password-changed", passwordChanged);

// Profile
import { listOrdersPage, orderDetailsPage, cancelProduct, returnProduct, downloadInvoice } from "../controller/user/orderController.js";
router.get("/profile", isAuth, viewProfile);
router.get("/profile/my-listings", isAuth, getMyListingsPage);


router.get("/profile/orders", isAuth, listOrdersPage);
router.patch("/profile/orders/cancel", isAuth, cancelProduct);
router.patch("/profile/orders/return", isAuth, returnProduct);
router.get("/profile/orders/:orderId", isAuth, orderDetailsPage);
router.get("/profile/orders/:orderId/invoice", isAuth, downloadInvoice);

router.route("/profile/edit")
  .get(isAuth, viewEditProfile)
  .patch(isAuth, upload.single("avatar"), editProfile);

router.post("/profile/edit/add-new-address", isAuth, addNewAddress);

router.patch("/profile/set-default-address", isAuth, setDefaultAddress);

router.patch("/profile/edit/address/:id", isAuth, editAddress);

router.delete("/profile/delete-address", isAuth, deleteAddress);
  
// Settings
router.get("/settings", isAuth, viewSettings);
router.patch("/settings/change-email", isAuth, changeEmail)
router.patch("/settings/change-password", isAuth, changePassword);

// Logout
router.get("/logout", isAuth, logout);



export default router;
