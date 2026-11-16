import multer from "multer";
import path from "path";
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_ADMIN_IMAGE_SIZE_BYTES,
  MAX_PRODUCT_IMAGE_COUNT,
} from "../utils/imageValidation.js";

const imageUploadError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const imageFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype) && ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    cb(null, true);
  } else {
    cb(imageUploadError("Only JPG, PNG, and WebP images are allowed."), false);
  }
};

const createImageUpload = ({ fileSize = MAX_ADMIN_IMAGE_SIZE_BYTES, files } = {}) =>
  multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFilter,
    limits: {
      fileSize,
      ...(files ? { files } : {}),
    },
  });

export const upload = createImageUpload({
  fileSize: 1024 * 1024 * 2,
  files: 1,
});

export const uploadProduct = createImageUpload({
  fileSize: MAX_ADMIN_IMAGE_SIZE_BYTES,
  files: MAX_PRODUCT_IMAGE_COUNT,
});

export const uploadCategory = createImageUpload({
  fileSize: MAX_ADMIN_IMAGE_SIZE_BYTES,
  files: 1,
});

export const uploadRental = createImageUpload({
  fileSize: MAX_ADMIN_IMAGE_SIZE_BYTES,
  files: MAX_PRODUCT_IMAGE_COUNT,
});
