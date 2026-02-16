import userDb from "../models/userDb.js";
import { otpCreator } from "../utils/otpGenerator.js";

export const verifyEmail = async (user, newEmail) => {
    console.log("service ", newEmail)
  const emailExists = await userDb.findOne({ newEmail });
  if (emailExists) {
    console.log(emailExists)
    console.log("service ", newEmail)
    throw new Error("Email has already been registered to a account.");
  }

  await otpCreator(user.firstName, newEmail);

  return true;
};

export const updateEmail = async (newEmail, userId) => {
    await userDb.findByIdAndUpdate(userId, { email: newEmail });
    return true;
}

