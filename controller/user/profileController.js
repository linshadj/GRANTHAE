import mongoose from "mongoose";
import addressDb from "../../models/addressDb.js";
import userDb from "../../models/userDb.js";
import {
  addNewAddressService,
  editAddressService,
  setDefaultAddressService,
  updateProfile,
} from "../../service/profileService.js";
import e from "express";

export const viewProfile = async (req, res) => {
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
    });
  } catch (err) {
    console.log("err in viewProfile", err.message);
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
  try {
    const userId = req.session.user;
    const { firstName, lastName, bio } = req.body;
    const updateData = { firstName, lastName, bio };
    if (req.file) {
      updateData.avatar = `/images/avatars/${req.file.filename}`;
    }
    const updatedUser = await updateProfile(updateData, userId);

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Success response
    return res.status(200).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("Profile successfully updated")}`,
    });
  } catch (err) {
    console.error("Error in editProfile:", err.message);
    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("New address added")}`,
    });
  } catch (err) {
    console.error("Error in addNewAddress: ", err.message);
    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("Default address updated")}`,
    });
  } catch (err) {
    console.error("Error in setDefaultAddress:", err.message);
    return res.status(500).json({
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

    return res.status(200).json({ success: true, redirectUrl: `/profile?status=success&message=${encodeURIComponent("Address updated")}` });
  } catch (err) {
    console.error("Error in editAddress:", err.message);
    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      redirectUrl: `/profile?status=success&message=${encodeURIComponent("Address deleted")}`,
    });
  } catch (err) {
    console.error("Error in deleteAddress:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete address",
    });
  }
}