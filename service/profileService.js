import mongoose from "mongoose";
import addressDb from "../models/addressDb.js";
import userDb from "../models/userDb.js";

export const updateProfile = async (updateData, userId) => {
  return await userDb.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
};

export const addNewAddressService = async (addressData, userId) => {
  const labelExists = await addressDb.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    label: addressData.label,
  });
  if (labelExists) {
    throw new Error("Address label already exists. Please choose a different label.");
  }

  const existingAddresses = await addressDb.find({ userId: new mongoose.Types.ObjectId(userId) });

  const newAddress = new addressDb({
    userId: new mongoose.Types.ObjectId(userId),
    ...addressData,
    isDefault: existingAddresses.length === 0, // Set as default if it's the first address
  });
  await newAddress.save();

  return true;
};

export const setDefaultAddressService = async (addressId, userId) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await addressDb.updateMany(
      { userId: userObjectId },
      { $set: { isDefault: false } }
    );

    await addressDb.findOneAndUpdate(
      { _id: addressId, userId: userObjectId },
      { $set: { isDefault: true } }
    );

    return true;
  } catch (err) {
    throw new Error("Error in setDefaultAddressService: " + err.message);
  }
};

export const editAddressService = async (addressData, userId, addressId) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const labelExists = await addressDb.findOne({
      userId: userObjectId,
      label: addressData.label,
      _id: { $ne: new mongoose.Types.ObjectId(addressId) },
    });
    if (labelExists) {
      throw new Error("Address label already exists. Please choose a different label.");
    }

    await addressDb.findOneAndUpdate(
      { _id: addressId, userId: userObjectId },
      { $set: addressData }
    );

    return true;
  } catch (err) {
    console.log("Error in editAddressService: " + err.message);
  }
}