export const adminDashboardPage = async (req, res) => {
    res.render("admin/dashboard", { title: "Admin Dashboard", layout: "layouts/admin-panel" });
}