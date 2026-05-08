import crypto from "crypto";
import fs from "fs";
import path from "path";
import cloudinary, { assertCloudinaryConfigured } from "../config/cloudinary.js";

const defaultRootFolder = "granthae";

const getCloudinaryFolder = (folderName) => {
  const rootFolder = process.env.CLOUDINARY_FOLDER || defaultRootFolder;
  return [rootFolder, folderName].filter(Boolean).join("/");
};

const buildPublicId = (originalName = "image") => {
  const baseName = path
    .parse(originalName)
    .name.toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${baseName || "image"}`;
};

const uploadStream = ({ folderName, publicId, streamFactory }) => {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: getCloudinaryFolder(folderName),
        public_id: publicId,
        resource_type: "image",
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) {
          return reject(new Error("Cloudinary upload did not return a secure URL"));
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    stream.on("error", reject);
    streamFactory(stream, reject);
  });
};

export const uploadImageToCloudinary = (file, folderName) => {
  if (!file?.buffer) {
    throw new Error("No image file provided for Cloudinary upload");
  }

  return uploadStream({
    folderName,
    publicId: buildPublicId(file.originalname),
    streamFactory: (stream) => stream.end(file.buffer),
  });
};

export const uploadLocalImageToCloudinary = (filePath, folderName) => {
  return uploadStream({
    folderName,
    publicId: buildPublicId(path.basename(filePath)),
    streamFactory: (stream, reject) => {
      const fileStream = fs.createReadStream(filePath);
      fileStream.on("error", reject);
      fileStream.pipe(stream);
    },
  });
};

export const deleteCloudinaryUploads = async (uploads) => {
  const publicIds = uploads.map((upload) => upload.publicId).filter(Boolean);
  await Promise.allSettled(publicIds.map((publicId) => cloudinary.uploader.destroy(publicId)));
};

export const uploadImagesToCloudinary = async (files = [], folderName) => {
  const uploaded = [];

  try {
    for (const file of files) {
      const upload = await uploadImageToCloudinary(file, folderName);
      uploaded.push(upload);
    }

    return uploaded;
  } catch (error) {
    await deleteCloudinaryUploads(uploaded);
    throw error;
  }
};
