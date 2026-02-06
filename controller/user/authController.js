import userDb from "../../models/userDb.js";
import {
  createNewUser,
  otpValidator,
  resendOtpService,
  signInVerify,
  signupVerify,
} from "../../service/authService.js";

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

    return res.status(200).json({ success: true, redirectUrl: "/home" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const signupData = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    const body = { firstName, lastName, email, password };
    const validateUser = await signupVerify(body);
    req.session.tempUser = body;

    return res.status(200).json({
      success: true,
      message: "User validated successfully.",
      data: validateUser,
      redirectUrl: "/otp",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const otpPage = (req, res) => {
  res.render("pages/otp", { title: "OTP Verification", layout: "layouts/auth" });
};

export const verifyOtpData = async (req, res) => {
  try {
    const tempUser = req.session.tempUser;
    const otp = req.body.otp;
    if (!tempUser) {
      return res.status(400).json({ success: false, message: "session expired" });
    }
    if (!otp) {
      return res.status(400).json({ success: false, message: "otp not found" });
    }
    const isOtpValid = await otpValidator(tempUser.email, otp);
    if (isOtpValid) {
      const newUser = await createNewUser(tempUser);
      req.session.tempUser = null;
      req.session.user = newUser;
      return res.status(200).json({ success: true, redirectUrl: "/home" });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const email = req.session.tempUser?.email;
    const firstName = req.session.tempUser?.firstName;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Session expired please retry the process again" });
    }

    const data = await resendOtpService(firstName, email);
    return res.status(200).json({ success: true, message: data.message });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "An error occurred while resending OTP. Please try again later.",
    });
  }
};

export const forgotPassword = (req, res) => {
  res.render("pages/forgot-password", { title: "Forgot Password", layout: "layouts/auth" });
}

export const homePage = async (req, res) => {
  const user = await userDb.findById(req.session.user);
  console.log(user);
  res.render("pages/home", { user });
};
