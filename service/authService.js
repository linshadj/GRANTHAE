import otpDb from "../models/otpDb.js";
import userDb from "../models/userDb.js";
import bcrypt from "bcrypt";
import { otpCreator } from "../utils/otpGenerator.js";
import { hashPass } from "../utils/passHasher.js";
import { validateEmail, validateName, validatePassword } from "../utils/validator.js";

export const signInVerify = async (userData) => {
  const { email, password } = userData;

  const user = await userDb.findOne({ email });

  if (!user) {
    throw new Error("Invalid credentials.");
  }
  if (!user.password) {
    throw new Error("Email is registered using google, Please login using google.");
  }
  if (user.isBlocked) {
    throw new Error("User has been blocked by admin.");
  }

  const isPassMatching = await bcrypt.compare(password, user.password);

  if (!isPassMatching) {
    throw new Error("Invalid credentials.");
  }

  return user;
};

export const signupVerify = async (userData) => {
  const { firstName, lastName, email, password } = userData;

  validateName(firstName);
  if (!validateName) throw new Error("First name should contain only letters.");

  validateName(lastName);
  if (!validateName) throw new Error("Last name should contain only letters.");

  validateEmail(email);
  if (!validateEmail) throw new Error("Please enter a valid email address.");

  validatePassword(password);
  if (!validatePassword)
    throw new Error(
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
    );

  const existingEmail = await userDb.findOne({ email });
  if (existingEmail) {
    throw new Error("Email is already registered.");
  }
  await otpCreator(firstName, email);
};

export const otpValidator = async (email, otp) => {
  const otpExists = await otpDb.findOne({ email }).sort({createdAt: -1});
  if (!otpExists) {
    throw new Error("OTP does not exist");
  }
  const isOtpMatching = otpExists.otp == otp;
  if (!isOtpMatching) {
    throw new Error("Incorrect OTP");
  }
  return true;
};

export const resendOtpService = async (firstName, email) => {
  await otpCreator(firstName, email);
  return { message: "New OTP sent successfully" };
};

export const forgotPassverify = async (email) => {
  const user = await userDb.findOne({ email });
  if (!user) {
    throw new Error("Email has not been registered to a account yet.");
  }

  if (!user.password) {
    throw new Error("This account is registered using google, Please login using google.");
  }

  await otpCreator(user.firstName, email);

  return user.firstName;
};

export const updatePassword = async (email, newPassword) => {
  const password = await bcrypt.hash(newPassword, 10);

  const updatedUser = await userDb.findOneAndUpdate(
    { email: email },
    { password: password },
    { new: true },
  );
  if (!updatedUser) {
    throw new Error("Update failed. Cannot find user");
  }
  return true;
};

export const createNewUser = async (body) => {
  const hashedPass = await hashPass(body.password);
  const newUser = await userDb.create({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    password: hashedPass,
  });
  return newUser._id;
};
