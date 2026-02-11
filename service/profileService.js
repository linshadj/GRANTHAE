import userDb from "../models/userDb.js";

export const updateProfile = async (updateData, userId) => {
  try {
    return await userDb.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
  } catch (err) {
    throw new Error("error in updateProfile: ", err.message);
  }
};