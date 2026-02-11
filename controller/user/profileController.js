import mongoose from "mongoose";
import addressDb from "../../models/addressDb.js";
import userDb from "../../models/userDb.js";
import { updateProfile } from "../../service/profileService.js";

export const viewProfile = async (req, res) => {
  try {
    const user = await userDb.findById(req.session.user);
    const addresses = await addressDb.find({
      userId: new mongoose.Types.ObjectId(req.session.user),
    });
    console.log(req.session.user, typeof req.session.user);
    console.log(addresses, typeof addresses);
    res.render("pages/profile", {
      user,
      addresses,
      title: "Profile",
      layout: "layouts/user-panel",
    });
  } catch (err) {
    console.log("err in getProfile", err.message);
  }
};

export const viewEditProfile = async (req, res) => {
  try {
    const user = await userDb.findById(req.session.user);
    const addresses = await addressDb.find({
      userId: new mongoose.Types.ObjectId(req.session.user),
    });
    console.log("afdkghjn");
    console.log(addresses);
    console.log("dwsokjm");
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
    console.log(req.body);
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
