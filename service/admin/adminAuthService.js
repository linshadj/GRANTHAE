import userDb from "../../models/userDb.js";
import bcrypt from "bcrypt";

export const adminLoginService = async (adminData) => {
  const { email, password } = adminData;

  const admin = await userDb.findOne({ email, role: "admin" });
  if (!admin) {
    throw new Error("Admin not found with this email.");
  }

  if(admin.isBlocked) {
    throw new Error("Admin account is blocked.");
  }

  if(!admin.password) {
    throw new Error("Email registered using google, Please use another email to sign in.");
  }


  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    throw new Error("Incorrect password.");
  }
  return admin;
};
