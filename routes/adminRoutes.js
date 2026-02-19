import express from "express";
import { ifAdmin, isAdmin } from "../middlewares/authMiddlewares.js";
import { adminLoginHandler, adminLoginPage, adminLogoutHandler } from "../controller/admin/adminAuthController.js";
import { adminDashboardPage } from "../controller/admin/dashboardController.js";
import { toggleBlockUser, usersPage } from "../controller/admin/userController.js";

const router = express.Router();

router.get("/", (req, res) => {
  return res.redirect("/login");
});

router.route("/login")
    .get(ifAdmin, adminLoginPage)
    .post(ifAdmin, adminLoginHandler);

router.get("/dashboard", isAdmin, adminDashboardPage);

router.route("/users")
    .get(isAdmin, usersPage)
    .post(isAdmin, adminLoginHandler);

router.patch("/users/toggle-block/:id/:action", isAdmin, toggleBlockUser);
export default router;

router.get("/logout", isAdmin, adminLogoutHandler);