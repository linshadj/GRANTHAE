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
import { addNewAddress, deleteAddress, editAddress, editProfile, setDefaultAddress, viewDashboard, viewEditProfile, viewProfile } from "../controller/user/profileController.js";
import { upload, uploadRental } from "../middlewares/multerUpload.js";
import { changeEmail, changePassword, viewSettings } from "../controller/user/settingsController.js";
import { listProducts, productDetails, submitProductReview } from "../controller/user/shopController.js";
import { getCartPage, addToCart, updateQuantity, removeFromCart } from "../controller/user/cartController.js";
import {
  completeRentalReturn,
  confirmRentalRequest,
  getEditRentalListingPage,
  getListRentalBookPage,
  getMyListingsPage,
  getMyRentalsPage,
  getRentalRequestsPage,
  getRentalReturnPage,
  rentalConfirmedPage,
  rentalDetailsPage,
  rentalPlacePage,
  rentalReturnSuccessPage,
  requestRentalBook,
  rejectRentalRequest,
  submitRentalListing,
  submitRentalReturn,
  submitRentalReview,
  toggleRentalListing,
  updateRentalListing
} from "../controller/user/rentalController.js";
import {
  addCheckoutAddress,
  applyCoupon,
  getCheckoutPage,
  markRazorpayPaymentFailed,
  orderSuccessPage,
  paymentFailurePage,
  placeOrder,
  removeCoupon,
  retryRazorpayPayment,
  verifyRazorpayPayment
} from "../controller/user/checkoutController.js";
import { getWishlistPage, addToWishlist, removeFromWishlist } from "../controller/user/wishlistController.js";
import { addFunds, getWalletPage, getAddFundsPage, markAddFundsFailed, verifyAddFunds } from "../controller/user/walletController.js";
import { listOrdersPage, orderDetailsPage, cancelProduct, returnProduct, downloadInvoice } from "../controller/user/orderController.js";


const router = express.Router();


router.get("/", (req, res) => {
  res.redirect("/home");
});

router.get("/home", homePage);

// Marketplace
router.get("/marketplace", listProducts);
router.get("/shop", (req, res) => res.redirect("/marketplace"));
router.get("/product/:id", productDetails);
router.post("/product/:id/reviews", isAuth, submitProductReview);

// Rental Place
router.get("/rental-place", rentalPlacePage);
router.post("/rentals/:rentalId/request", isAuth, requestRentalBook);
router.get("/rentals/:rentalOrderId/confirmed", isAuth, rentalConfirmedPage);
router.get("/rental/:id", rentalDetailsPage);
router.post("/rental/:id/reviews", isAuth, submitRentalReview);
router.get("/list-rental-book", isAuth, getListRentalBookPage);
router.post("/list-rental-book", isAuth, uploadRental.array("images", 10), submitRentalListing);
router.get("/list-book", (req, res) => res.redirect("/list-rental-book")); // Handle existing Sell link


// Cart
router.get("/cart", isAuth, getCartPage);
router.post("/cart/add", isAuth, addToCart);
router.patch("/cart/update", isAuth, updateQuantity);
router.delete("/cart/remove", isAuth, removeFromCart);

// Checkout
router.get("/checkout", isAuth, getCheckoutPage);
router.post("/checkout/address", isAuth, addCheckoutAddress);
router.post("/checkout/apply-coupon", isAuth, applyCoupon);
router.post("/checkout/remove-coupon", isAuth, removeCoupon);
router.post("/checkout/place-order", isAuth, placeOrder);
router.post("/checkout/razorpay/verify", isAuth, verifyRazorpayPayment);
router.post("/checkout/razorpay/failure", isAuth, markRazorpayPaymentFailed);
router.post("/checkout/razorpay/retry/:orderId", isAuth, retryRazorpayPayment);
router.get("/order-success/:orderId", isAuth, orderSuccessPage);
router.get("/payment-failure/:orderId", isAuth, paymentFailurePage);

// Wishlist
router.get("/wishlist", isAuth, getWishlistPage);
router.post("/wishlist/add", isAuth, addToWishlist);
router.delete("/wishlist/remove", isAuth, removeFromWishlist);

// Wallet
router.get("/wallet", isAuth, getWalletPage);
router.get("/wallet/add-funds", isAuth, getAddFundsPage);
router.post("/wallet/add-funds", isAuth, addFunds);
router.post("/wallet/add-funds/verify", isAuth, verifyAddFunds);
router.post("/wallet/add-funds/failure", isAuth, markAddFundsFailed);

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
router.get("/dashboard", isAuth, viewDashboard);
router.get("/profile", isAuth, viewProfile);
router.get("/profile/rentals", isAuth, getMyRentalsPage);
router.get("/profile/rentals/:rentalOrderId/return", isAuth, getRentalReturnPage);
router.post("/profile/rentals/:rentalOrderId/return", isAuth, submitRentalReturn);
router.get("/profile/rentals/:rentalOrderId/return/success", isAuth, rentalReturnSuccessPage);
router.patch("/profile/rentals/:rentalOrderId/confirm", isAuth, confirmRentalRequest);
router.patch("/profile/rentals/:rentalOrderId/reject", isAuth, rejectRentalRequest);
router.patch("/profile/rentals/:rentalOrderId/return/complete", isAuth, completeRentalReturn);
router.get("/profile/my-listings", isAuth, getMyListingsPage);
router.get("/profile/my-listings/rental-requests", isAuth, getRentalRequestsPage);
router.get("/profile/my-listings/:id/edit", isAuth, getEditRentalListingPage);
router.patch("/profile/my-listings/:id", isAuth, uploadRental.array("images", 10), updateRentalListing);
router.patch("/profile/my-listings/:id/toggle", isAuth, toggleRentalListing);


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
