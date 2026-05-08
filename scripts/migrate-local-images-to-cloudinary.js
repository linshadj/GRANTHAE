import dotenv from "dotenv";
import fs from "fs/promises";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { Category } from "../models/categoryDb.js";
import { Product } from "../models/productDb.js";
import { Rental } from "../models/rentalDb.js";
import userDb from "../models/userDb.js";
import { connectDb } from "../config/dbConnect.js";
import { uploadLocalImageToCloudinary } from "../utils/cloudinaryUploader.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const migratedUrls = new Map();

const isLocalImageUrl = (url) => {
  return typeof url === "string" && (url.startsWith("/uploads/") || url.startsWith("/images/avatars/"));
};

const getFolderName = (url) => {
  if (url.startsWith("/uploads/products/")) return "products";
  if (url.startsWith("/uploads/categories/")) return "categories";
  if (url.startsWith("/uploads/rentals/")) return "rentals";
  if (url.startsWith("/images/avatars/")) return "avatars";
  return "misc";
};

const getPublicFilePath = (url) => path.join(projectRoot, "public", url);

const migrateImageUrl = async (url) => {
  if (!isLocalImageUrl(url)) return url;
  if (migratedUrls.has(url)) return migratedUrls.get(url);

  const filePath = getPublicFilePath(url);

  try {
    await fs.access(filePath);
  } catch {
    console.warn(`Skipped missing local file: ${url}`);
    migratedUrls.set(url, url);
    return url;
  }

  const upload = await uploadLocalImageToCloudinary(filePath, getFolderName(url));
  migratedUrls.set(url, upload.url);
  console.log(`Migrated ${url} -> ${upload.url}`);
  return upload.url;
};

const migrateImageArray = async (images = []) => {
  const migratedImages = [];

  for (const image of images) {
    migratedImages.push(await migrateImageUrl(image));
  }

  return migratedImages;
};

const migrateProducts = async () => {
  const products = await Product.find({
    $or: [{ images: /^\/uploads\/products\// }, { coverImage: /^\/uploads\/products\// }],
  });

  for (const product of products) {
    const images = await migrateImageArray(product.images);
    const coverImage = await migrateImageUrl(product.coverImage);

    product.images = images;
    product.coverImage = coverImage;
    await product.save();
    console.log(`Updated product ${product._id}`);
  }
};

const migrateCategories = async () => {
  const categories = await Category.find({ coverImage: /^\/uploads\/categories\// });

  for (const category of categories) {
    category.coverImage = await migrateImageUrl(category.coverImage);
    await category.save();
    console.log(`Updated category ${category._id}`);
  }
};

const migrateRentals = async () => {
  const rentals = await Rental.find({
    $or: [{ images: /^\/uploads\/rentals\// }, { coverImage: /^\/uploads\/rentals\// }],
  });

  for (const rental of rentals) {
    rental.images = await migrateImageArray(rental.images);
    rental.coverImage = await migrateImageUrl(rental.coverImage);
    await rental.save();
    console.log(`Updated rental ${rental._id}`);
  }
};

const migrateUsers = async () => {
  const users = await userDb.find({ avatar: /^\/images\/avatars\// });

  for (const user of users) {
    user.avatar = await migrateImageUrl(user.avatar);
    await user.save();
    console.log(`Updated user ${user._id}`);
  }
};

try {
  await connectDb();
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Could not connect to MongoDB");
  }

  await migrateProducts();
  await migrateCategories();
  await migrateRentals();
  await migrateUsers();
  console.log("Local image migration complete.");
} catch (error) {
  console.error("Local image migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close();
}
