import bcrypt from "bcrypt";
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

export const hashOtp = async (otp) => {
  const saltRounds = 10;
  const hashedOtp = await bcrypt.hash(otp, saltRounds);
  return hashedOtp;
};

export const compareHashedOtp = async (plainOtp, hashedOtp) => {
    const isOtpMatching = bcrypt.compare(plainOtp, hashedOtp, (err) => {
        if (err) console.log('error in comparing pass: ', err.message);
    })

    return isOtpMatching
};
