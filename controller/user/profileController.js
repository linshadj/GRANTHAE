import mongoose from "mongoose";
import { STATUS_CODES } from "../../utils/statusCodes.js";
import addressDb from "../../models/addressDb.js";
import userDb from "../../models/userDb.js";
import {
  addNewAddressService,
  editAddressService,
  setDefaultAddressService,
  updateProfile,
} from "../../service/user/profileService.js";
import { getWallet } from "../../service/user/walletService.js";
import orderDb from "../../models/orderDb.js";
import wishlistDb from "../../models/wishlistDb.js";
import { Rental } from "../../models/rentalDb.js";
import { deleteCloudinaryUploads, uploadImageToCloudinary } from "../../utils/cloudinaryUploader.js";

export const viewDashboard = async (req, res, next) => {
  try {
    const user = await userDb.findById(req.session.user);

    const [
      orderCount,
      activeOrders,
      pendingReturnRequests,
      wallet,
      wishlist,
      listingCount,
      pendingListings,
      recentOrders,
      recentListings,
    ] = await Promise.all([
      orderDb.countDocuments({ user: user._id }),
      orderDb.countDocuments({ user: user._id, orderStatus: { $in: ["Pending", "Shipped", "Out for delivery"] } }),
      orderDb.countDocuments({
        user: user._id,
        items: { $elemMatch: { itemStatus: "Return Requested", returnRequestStatus: "Pending" } },
      }),
      getWallet(user._id),
      wishlistDb.findOne({ user: user._id }).select("items"),
      Rental.countDocuments({ owner: user._id, isDeleted: false }),
      Rental.countDocuments({ owner: user._id, isDeleted: false, status: "Pending" }),
      orderDb.find({ user: user._id }).sort({ createdAt: -1 }).limit(5),
      Rental.find({ owner: user._id, isDeleted: false }).populate("category").sort({ createdAt: -1 }).limit(5),
    ]);

    res.render("pages/dashboard", {
      user,
      dashboard: {
        orderCount,
        activeOrders,
        pendingReturnRequests,
        walletBalance: wallet.balance || 0,
        wishlistCount: wishlist?.items?.length || 0,
        listingCount,
        pendingListings,
      },
      recentOrders,
      recentListings,
      title: "Dashboard",
      layout: "layouts/user-panel",
      path: "/dashboard",
    });
  } catch (err) {
    console.log("err in viewDashboard", err.message);
    next(err);
  }
};

export const viewProfile = async (req, res, next) => {
  try {
    const user = await userDb.findById(req.session.user);
    const addresses = await addressDb
      .find({
        userId: new mongoose.Types.ObjectId(user._id),
      })
      .sort({ isDefault: -1, createdAt: -1 });

    res.render("pages/profile", {
      user,
      addresses,
      title: "Profile",
      layout: "layouts/user-panel",
      path: "/profile",
    });
  } catch (err) {
    console.log("err in viewProfile", err.message);
    next(err);
  }
};

export const viewEditProfile = async (req, res) => {
  try {
    const user = await userDb.findById(req.session.user);
    const addresses = await addressDb
      .find({
        userId: new mongoose.Types.ObjectId(user._id),
      })
      .sort({ isDefault: -1, createdAt: -1 });
    res.render("pages/edit-profile", {
      user,
      addresses,
      title: "Edit Profile",
      layout: "layouts/user-panel",
    });
  } catch (err) {
    console.log("err in getProfile", err.message);
  }
};

export const editProfile = async (req, res) => {
  let uploadedAvatar = null;

  try {
    const userId = req.session.user;
    const { firstName, lastName, bio } = req.body;
    const updateData = { firstName, lastName, bio };
    if (req.file) {
      uploadedAvatar = await uploadImageToCloudinary(req.file, "avatars");
      updateData.avatar = uploadedAvatar.url;
    }
    const updatedUser = await updateProfile(updateData, userId);

    if (!updatedUser) {
      return res.status(STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "User not found",
      });
    }

    // Success response
    return res.status(STATUS_CODES.OK).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("Profile successfully updated")}`,
    });
  } catch (err) {
    if (uploadedAvatar) {
      await deleteCloudinaryUploads([uploadedAvatar]);
    }
    console.error("Error in editProfile:", err.message);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const addNewAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { label, streetAddress, city, state, country, pinCode, phoneNumber } = req.body;
    const addressData = { label, streetAddress, city, state, country, pinCode, phoneNumber };

    await addNewAddressService(addressData, userId);

    return res.status(STATUS_CODES.OK).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("New address added")}`,
    });
  } catch (err) {
    console.error("Error in addNewAddress: ", err.message);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: err.message,
    });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;

    await setDefaultAddressService(addressId, userId);

    return res.status(STATUS_CODES.OK).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("Default address updated")}`,
    });
  } catch (err) {
    console.error("Error in setDefaultAddress:", err.message);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update default address",
    });
  }

};

export const editAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const addressId = req.params.id;
    const { label, streetAddress, city, state, country, pinCode, phoneNumber } = req.body;
    const addressData = { label, streetAddress, city, state, country, pinCode, phoneNumber };

    await editAddressService(addressData, userId, addressId); 

    return res.status(STATUS_CODES.OK).json({ success: true, redirectUrl: `/profile?status=success&message=${encodeURIComponent("Address updated")}` });
  } catch (err) {
    console.error("Error in editAddress:", err.message);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: err,
    });
  }
}

export const deleteAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;

    await addressDb.findOneAndDelete({ _id: addressId, userId: new mongoose.Types.ObjectId(userId) });

    return res.status(STATUS_CODES.OK).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("Address deleted")}`,
    });
  } catch (err) {
    console.error("Error in deleteAddress:", err.message);
    return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to delete address",
    });
  }
}
