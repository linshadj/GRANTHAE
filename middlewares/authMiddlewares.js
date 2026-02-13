import userDb from "../models/userDb.js";

export const otpVerify = (req, res, next) => {
  const otpRequested = req.session.otpRequested;
  if (!otpRequested) {
    return res.redirect("/sign-up");
  }
  return next();
};

export const resetPassAuth = (req, res, next) => {
  if (req.session.canResetPass) {
    return next();
  }
  return res.redirect("/forgot-password");
};

export const isAuth = async (req, res, next) => {
  if (req.session.user) {
    const user = await userDb.findById(req.session.user);
    if (!user.isBlocked) {
      return next();
    }
  }
  res.redirect(`/sign-in?status=error&message=${encodeURIComponent("Please login")}`);
  next();
};

export const ifAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect("/");
  }
  return next();
};

export const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    return next();
  }
  return res.redirect("/admin");
  next();
};

export const ifAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    return res.redirect("/admin/dashboard");
  }
  return next();
};