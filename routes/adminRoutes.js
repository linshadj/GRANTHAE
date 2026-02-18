import express from "express";
import { ifAdmin } from "../middlewares/authMiddlewares.js";
import { adminLoginHandler, adminLoginPage } from "../controller/admin/adminAuthController.js";
import { adminDashboardPage } from "../controller/admin/dashboardController.js";

const router = express.Router();

router.get("/", (req, res) => {
  return res.redirect("/login");
});

router.route("/login")
    .get(ifAdmin, adminLoginPage)
    .post(ifAdmin, adminLoginHandler);


router.get("/dashboard", adminDashboardPage);
export default router;
