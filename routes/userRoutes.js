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
import { editProfile, viewEditProfile, viewProfile } from "../controller/user/profileController.js";
import { upload } from "../middlewares/multerUpload.js";
import { changeEmail, viewSettings } from "../controller/user/settingsController.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/home");
});

router.get("/home", homePage);

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
  .get(isAuth, forgotPassword)
  .post(isAuth, forgotPassData);

// Reset Password
router.route("/reset-password")
  .get(resetPassAuth, setNewPass)
  .patch(resetPassAuth, setNewPassData);

router.get("/password-changed", passwordChanged);

// Profile
router.get("/profile", isAuth, viewProfile);

router.route("/profile/edit")
  .get(isAuth, viewEditProfile)
  .patch(isAuth, upload.single("avatar"), editProfile);

// Settings
router.get("/settings", isAuth, viewSettings);
router.post("/change-email", isAuth, changeEmail)

// Logout
router.get("/logout", isAuth, logout);



export default router;
