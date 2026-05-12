import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

cloudinary.config(
  process.env.CLOUDINARY_URL
    ? { secure: true }
    : {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      },
);

export const assertCloudinaryConfigured = () => {
  if (process.env.CLOUDINARY_URL) return;

  const missingKeys = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ].filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Cloudinary is not configured. Missing: ${missingKeys.join(", ")}`);
  }
};

export default cloudinary;
