import userDb from "../models/userDb.js";

const wantsJsonResponse = (req) => req.xhr
  || req.headers.accept?.includes("application/json")
  || req.headers["content-type"]?.includes("application/json")
  || req.headers["content-type"]?.includes("multipart/form-data");

const clearSession = (req, res, callback) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    callback();
  });
};

export const otpVerify = (req, res, next) => {
  const otpRequested = req.session.otpRequested;
  if (!otpRequested) {
    return res.redirect("/sign-up");
  }
  return next();
};

export const resetPassAuth = (req, res, next) => {
  if (req.session?.canResetPass) {
    return next();
  }

  if (req.method !== "GET") {
    return res.status(403).json({
      success: false,
      message: "Session expired. Please redo the password reset process.",
      redirectUrl: "/forgot-password",
    });
  }

  return res.redirect("/forgot-password");
};

export const isAuth = async (req, res, next) => {
  const wantsJson = wantsJsonResponse(req);

  if (req.session.user) {
    const user = await userDb.findById(req.session.user);
    if (user && !user.isBlocked) {
      req.user = user;
      return next();
    }

    if (user?.isBlocked) {
      const message = "Your account has been blocked by admin.";
      return clearSession(req, res, () => {
        if (wantsJson) {
          return res.status(403).json({
            success: false,
            message,
            redirectUrl: `/sign-in?status=error&message=${encodeURIComponent(message)}`
          });
        }
        return res.redirect(`/sign-in?status=error&message=${encodeURIComponent(message)}`);
      });
    }
  }

  if (wantsJson) {
    return res.status(401).json({
      success: false,
      message: "Please login",
      redirectUrl: "/sign-in?status=error&message=Please%20login"
    });
  }

  return res.redirect(`/sign-in?status=error&message=${encodeURIComponent("Please login")}`);
};

export const ifAuth = async (req, res, next) => {
  if (req.session && req.session.user) {
    const wantsJson = wantsJsonResponse(req);
    const user = await userDb.findById(req.session.user);

    if (user && !user.isBlocked) {
      return wantsJson
        ? res.status(409).json({ success: false, message: "You are already signed in.", redirectUrl: "/dashboard" })
        : res.redirect("/dashboard");
    }

    if (user?.isBlocked) {
      const message = "Your account has been blocked by admin.";
      return clearSession(req, res, () => {
        if (wantsJson) {
          return res.status(403).json({
            success: false,
            message,
            redirectUrl: `/sign-in?status=error&message=${encodeURIComponent(message)}`
          });
        }
        return res.redirect(`/sign-in?status=error&message=${encodeURIComponent(message)}`);
      });
    }
  }
  return next();
};

export const isAdmin = async (req, res, next) => {
  if (req.session.isAdmin) {
    const admin = await userDb.findOne({ _id: req.session.adminId, role: "admin" } );
    if (admin && !admin.isBlocked) {
      return next();
    }
  }
  return res.redirect(`/admin/login?status=error&message=${encodeURIComponent("Please login")}`);
};

export const ifAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect("/admin/dashboard");
  }
  return next();
};
