import {
  signUp,
  signupData,
  otpPage,
  verifyOtpData,
  homePage,
  signIn,
  signInData,
  resendOtp,
  forgotPassword,
} from "../controller/user/authController.js";
import express from "express";
import {
  googleAuth,
  googleAuthCallbackMiddleware,
  googleAuthSuccess,
} from "../controller/user/googleAuthController.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/home");
});

router.get("/home", homePage);

router.get("/sign-in", signIn);
router.post("/sign-in", signInData);

router.get("/sign-up", signUp);
router.post("/sign-up", signupData);

router.get("/auth/google", googleAuth);
router.get("/auth/google/callback", googleAuthCallbackMiddleware, googleAuthSuccess);

router.get("/otp", otpPage);
router.post("/otp", verifyOtpData);

router.post("/resend-otp", resendOtp);

router.get("/forgot-password", forgotPassword);

router.get("/profile", (req, res) => {
  res.render("pages/profile", { title: "Profile", layout: "layouts/user-panel" });
});
router.get("/profile/edit", (req, res) => {
  res.render("pages/edit-profile", { title: "Edit Profile", layout: "layouts/user-panel" });
});

export default router;
