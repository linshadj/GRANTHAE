import otpDb from "../models/otpDb.js";
import otpGenerator from "otp-generator";

export const otpCreator = async (firstName, email) => {
  let otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
  console.log(firstName, "otp Generated");
  await otpDb.create({ firstName, email, otp });
};
