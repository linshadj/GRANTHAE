import userDb from "../models/userDb.js";

export const otpVerify = (req, res, next) => {
  const otpRequested = req.session.otpRequested;
  if (!otpRequested) {
    return res.redirect("/sign-up");
  }
  return next();
};

export const resetPassAuth = async (req, res, next) => {
  if (req.session.canResetPass) {  // ...existing code...
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.redirect(`/admin/orders?status=error&message=${encodeURIComponent("Order not found")}`);
  }
  
  order.status = "Delivered";
  order.orderStatus = "Delivered"; // keep both fields in sync if the app uses either
  order.isDelivered = true;
  order.deliveredAt = new Date();
  
  await order.save();
  // ...existing code...
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
  return res.redirect(`/sign-in?status=error&message=${encodeURIComponent("Please login")}`);
};

export const ifAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return res.redirect("/");
  }
  return next();
};

export const isAdmin = async (req, res, next) => {
  if (req.session.isAdmin) {
    const admin = await userDb.findOne({ _id: req.session.adminId, role: "admin" } );
    if (!admin.isBlocked) {
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