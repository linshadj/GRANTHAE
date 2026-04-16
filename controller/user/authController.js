import userDb from "../../models/userDb.js";
import {
  createNewUser,
  forgotPassverify,
  otpValidator,
  resendOtpService,
  signInVerify,
  signupVerify,
  updatePassword,
} from "../../service/user/authService.js";
import { updateEmail } from "../../service/user/settingsService.js";
import { STATUS_CODES } from "../../utils/statusCodes.js";


export const signIn = async (req, res) => {
  res.render("pages/login", { title: "SignIn", layout: "layouts/auth" });
};

export const signUp = (req, res) => {
  res.render("pages/signup", { title: "Signup", layout: "layouts/auth" });
};

export const signInData = async (req, res) => {
  try {
    const { email, password } = req.body;
    const body = { email, password };
    const user = await signInVerify(body);
    req.session.user = user._id;

    return res.status(STATUS_CODES.OK).json({ success: true, redirectUrl: "/home" });
  } catch (error) {
    console.log(error);
    return res.status(error.status || STATUS_CODES.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

export const signupData = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const body = { firstName, lastName, email, password };
    const validateUser = await signupVerify(body);
    req.session.tempUser = body;
    req.session.otpRequested = true

    return res.status(STATUS_CODES.OK).json({
      success: true,
      message: "User validated successfully.",
      data: validateUser,
      redirectUrl: "/otp",
    });
  } catch (error) {
    console.log(error);
    return res.status(error.status || STATUS_CODES.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

export const otpPage = (req, res) => {
  res.render("pages/otp", { title: "OTP Verification", layout: "layouts/auth" });
};

export const otpHandler = async (req, res) => {
  try {
    const otp = req.body.otp;
    const { tempUser, forgotPassEmail, newEmail } = req.session;
    const email = tempUser?.email || forgotPassEmail || newEmail;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Session expired. Please try again" });
    }
    if (!otp) {
      return res.status(STATUS_CODES.BAD_REQUEST).json({ success: false, message: "OTP not found" });
    }

    await otpValidator(email, otp);

    req.session.otpRequested = false;

    if (tempUser) {
      const newUser = await createNewUser(tempUser);
      req.session.tempUser = null;
      req.session.user = newUser;
      return res.status(STATUS_CODES.OK).json({ success: true, redirectUrl: "/home" });
    } else if (forgotPassEmail) {
      req.session.canResetPass = true;
      return res.status(STATUS_CODES.OK).json({ success: true, redirectUrl: "/reset-password" });
    } else if (newEmail) {
      await updateEmail(req.session.newEmail, req.session.user);
      req.session.newEmail = null;
      return res.status(STATUS_CODES.OK).json({
        success: true,
        redirectUrl: "/settings?status=success&message= email updated",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(error.status || STATUS_CODES.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = req.session.tempUser?.email || req.session.forgotPassEmail;
    const firstName = req.session.tempUser?.firstName || req.session.firstName;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Session expired please retry the process again" });
    }

    const data = await resendOtpService(firstName, email);
    return res.status(STATUS_CODES.OK).json({ success: true, message: data.message });
  } catch (error) {
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "An error occurred while resending OTP. Please try again later.",
    });
  }
};

export const forgotPassword = (req, res) => {
  res.render("pages/forgot-password", { title: "Forgot Password", layout: "layouts/auth" });
};

export const forgotPassData = async (req, res) => {
  try {
    const { email } = req.body;

    req.session.tempUser = null;
    req.session.forgotPassEmail = email;

    const firstName = await forgotPassverify(email);

    req.session.firstName = firstName;
    req.session.otpRequested = true;

    return res.status(STATUS_CODES.OK).json({ success: true, redirectUrl: "/otp" });
  } catch (error) {
    console.log("error in forgotPassData: ", error.message);
    return res.status(error.status || STATUS_CODES.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

export const setNewPass = (req, res) => {
  res.render("pages/reset-password", { title: "Set New Password", layout: "layouts/auth" });
};

export const setNewPassData = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const email = req.session.forgotPassEmail;

    if (!email || !newPassword) {
      return res.status(STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "Session expired. Please redo again.",
      });
    }

    await updatePassword(email, newPassword);

    req.session.forgotPassEmail = null;
    req.session.canResetPass = false;
    req.session.otpRequested = false;

    return res.status(STATUS_CODES.OK).json({ success: true, redirectUrl: "/password-changed" });
  } catch (error) {
    console.log("Error in resetPassData: ", error);
    return res.status(error.status || STATUS_CODES.BAD_REQUEST).json({ success: false, message: error.message });
  }
};

export const passwordChanged = (req, res) => {
  res.render("pages/password-changed", { title: "Password Changed", layout: "layouts/auth" });
};

export const homePage = async (req, res) => {
  const user = await userDb.findById(req.session.user);
  res.render("pages/home", { user });
};

export const logout = (req, res) => {
  try {
    req.session.destroy((error) => {
      if (error) {
        console.log(error);
        return res.redirect("/profile?status=error&message=Failed to logout");
      }
      res.clearCookie("connect.sid");
      return res.redirect("/sign-in?status=success&message=Successfully logged out");
    });
  } catch (error) {
    console.log("Error in logout: ", error);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ success: false, message: "Failed to logout" });
  }
};
