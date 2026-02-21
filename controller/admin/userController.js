import { toggleBlockUserService, userDetails } from "../../service/admin/userService.js";

export const usersPage = async (req, res) => {
  const page = req.query.page || 1;
  const search = req.query.search || "";
  const sort = req.query.sort || "newest";
  const filter = req.query.filter || "all";

  const userDb = await userDetails(page, search, sort, filter);
  res.render("admin/users", { userDb, title: "Users Management", layout: "layouts/admin-panel" });
};

export const toggleBlockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const action = req.params.action;

    console.log("Toggling block status for userId:", userId, "Action:", action);

    await toggleBlockUserService(userId, action);

    return res.status(200).json({ success: true, message: `User has been ${action}ed successfully.`, redirectUrl: "/admin/users?status=updated&&message=User+has+been+successfully+updated." });
  } catch (error) {
    console.error("Error in toggleBlockUser: ", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export const liveUsersSearch = async (req, res) => {
  try {
    const page = 1; // Always first page during live search
    const search = req.query.search || "";
    const sort = req.query.sort || "newest";
    const filter = req.query.filter || "all";

    const userDbData = await userDetails(page, search, sort, filter);

    res.json({
      success: true,
      users: userDbData.users,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

