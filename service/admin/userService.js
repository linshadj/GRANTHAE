import userDb from "../../models/userDb.js";
import addressDb from "../../models/addressDb.js";
import orderDb from "../../models/orderDb.js";

export const userDetails = async (page, searchQuery, sort, filter) => {
  const limit = 3;
  const skip = (page - 1) * limit;

  const searchFilter = {};
  if (searchQuery) {
    searchFilter.$or = [
      { firstName: { $regex: searchQuery, $options: "i" } },
      { lastName: { $regex: searchQuery, $options: "i" } },
    ];
  }

  let filterOptions = {};
  if (filter === "active") filterOptions.isBlocked = false;
  else if (filter === "blocked") filterOptions.isBlocked = true;
  else if (filter === "user") filterOptions.role = "user";
  else if (filter === "admin") filterOptions.role = "admin";

  let sortOptions = { firstName: 1 };
  if (sort === "newest") sortOptions = { createdAt: -1 };
  else if (sort === "oldest") sortOptions = { createdAt: 1 };
  else if (sort === "a-z") sortOptions = { firstName: 1, lastName: 1 };
  else if (sort === "z-a") sortOptions = { firstName: -1, lastName: -1 };

  const finalQuery = { ...searchFilter, ...filterOptions };

  const [blockedUsers, activeUsers, totalUsersCount, totalAdminsCount, users, totalFilteredUser] =
    await Promise.all([
      userDb.countDocuments({ isBlocked: true }),
      userDb.countDocuments({ isBlocked: false }),
      userDb.countDocuments({ role: "user" }),
      userDb.countDocuments({ role: "admin" }),
      userDb
        .find(finalQuery)
        .collation({ locale: "en", strength: 2 })
        .sort(sortOptions)
        .skip(skip)
        .limit(limit),
      userDb.countDocuments(finalQuery),
    ]);

  return {
    blockedUsers,
    activeUsers,
    totalUsers: blockedUsers + activeUsers,
    totalUsersCount,
    totalAdminsCount,
    users,
    totalFilteredUser,
    limit,
    totalPages: Math.ceil(totalFilteredUser / limit),
    currentPage: Number(page),
    searchQuery,
    selectedSort: sort,
    selectedFilter: filter,
  };
};

export const toggleBlockUserService = async (userId, action) => {
  const user = await userDb.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  if (user.role === "admin") {
    throw new Error("Cannot block/unblock an admin user");
  }
  if (action === "block") {
    user.isBlocked = true;
    console.log("Blocking user:", userId);
  } else if (action === "unblock") {
    user.isBlocked = false;
  } else {
    throw new Error("Invalid action");
  }
  await user.save();

  return true
};

export const getUserById = async (userId) => {
  const user = await userDb.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const [addresses, orders] = await Promise.all([
    addressDb.find({ userId }),
    orderDb.find({ user: userId }).populate('items.product', 'name coverImage').sort({ createdAt: -1 }).limit(10)
  ]);
  return { user, addresses, orders };
};
