import { adminLoginService } from "../../service/admin/adminAuthService.js";

export const adminLoginPage = async (req, res) => {
  res.render("admin/login", { title: "Admin Login", layout: "layouts/auth" });
};

export const adminLoginHandler = async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminData = { email, password };
    const admin = await adminLoginService(adminData);

    req.session.isAdmin = true;
    req.session.adminId = admin._id;

    return res.status(200).json({
      success: true,
      redirectUrl: "/admin/dashboard",
    });
  } catch (err) {
    console.error("Error in adminLoginHandler: ", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


export const adminLogoutHandler = (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying admin session: ", err);
        return res.status(500).json({ success: false, message: "Failed to log out" });
      }
      res.clearCookie("connect.sid");
      return res.status(200).json({ success: true, redirectUrl: "/admin/login?status=success&message=Logged out successfully" });
    });
  } catch (err) {
    console.error("Error in adminLogoutHandler: ", err.message);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}