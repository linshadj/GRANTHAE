import userDb from "../models/userDb.js";
import { otpCreator } from "../utils/otpGenerator.js";
import bcrypt from "bcrypt";

export const verifyEmail = async (user, newEmail) => {
  console.log("service ", newEmail);
  const emailExists = await userDb.findOne({ email: newEmail });
  if (emailExists) {
    console.log(emailExists);
    throw new Error("Email has already been registered to a account.");
  }

  await otpCreator(user.firstName, newEmail);

  return true;
};

export const updateEmail = async (newEmail, userId) => {
  await userDb.findByIdAndUpdate(userId, { email: newEmail });
  return true;
};

export const changePasswordService = async (userId, currentPassword, newPassword) => {

  const user = await userDb.findById(userId);

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new Error("Current password is incorrect.");
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);
  await userDb.findByIdAndUpdate(userId, { password: hashedNewPassword });

  return true;
}