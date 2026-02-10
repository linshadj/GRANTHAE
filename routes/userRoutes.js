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

const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/home");
});

router.get("/home", homePage);

router.get("/sign-in", ifAuth, signIn);
router.post("/sign-in", ifAuth, signInData);

router.get("/sign-up", ifAuth, signUp);
router.post("/sign-up", ifAuth, signupData);

router.get("/auth/google", googleAuth);
router.get("/auth/google/callback", googleAuthCallbackMiddleware, googleAuthSuccess);

router.get("/otp", otpVerify, otpPage);
router.post("/otp", otpVerify, otpHandler);

router.post("/resend-otp", resendOtp);

router.get("/forgot-password", isAuth, forgotPassword)
router.post("/forgot-password", isAuth, forgotPassData);

router.get("/reset-password", resetPassAuth, setNewPass)
router.patch("/reset-password", resetPassAuth, setNewPassData)

router.get("/password-changed", passwordChanged)

router.get("/profile", isAuth, (req, res) => {
  res.render("pages/profile", { title: "Profile", layout: "layouts/user-panel" });
});
router.get("/profile/edit", isAuth, (req, res) => {
  res.render("pages/edit-profile", { title: "Edit Profile", layout: "layouts/user-panel" });
});

router.get("/logout", isAuth, logout)

export default router;
