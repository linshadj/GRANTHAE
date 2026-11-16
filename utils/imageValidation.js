import path from "path";

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export const MAX_ADMIN_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MIN_PRODUCT_IMAGE_COUNT = 3;
export const MAX_PRODUCT_IMAGE_COUNT = 10;

const formatMb = (bytes) => `${Math.round(bytes / (1024 * 1024))}MB`;

const hasJpegSignature = (buffer) => (
  buffer.length >= 3
  && buffer[0] === 0xff
  && buffer[1] === 0xd8
  && buffer[2] === 0xff
);

const hasPngSignature = (buffer) => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return buffer.length >= signature.length
    && signature.every((byte, index) => buffer[index] === byte);
};

const hasWebpSignature = (buffer) => (
  buffer.length >= 12
  && buffer.toString("ascii", 0, 4) === "RIFF"
  && buffer.toString("ascii", 8, 12) === "WEBP"
);

const hasValidImageSignature = (file) => {
  if (!file?.buffer) return false;

  if (file.mimetype === "image/jpeg") return hasJpegSignature(file.buffer);
  if (file.mimetype === "image/png") return hasPngSignature(file.buffer);
  if (file.mimetype === "image/webp") return hasWebpSignature(file.buffer);

  return false;
};

export const getImageValidationMessage = (file, {
  maxSize = MAX_ADMIN_IMAGE_SIZE_BYTES,
} = {}) => {
  if (!file) return "Please select an image to upload.";

  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    return "Only JPG, PNG, and WebP images are allowed.";
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    return "Only .jpg, .jpeg, .png, and .webp image files are allowed.";
  }

  if (Number(file.size || 0) > maxSize) {
    return `Each image must be ${formatMb(maxSize)} or smaller.`;
  }

  if (!hasValidImageSignature(file)) {
    return "Invalid image file. Please upload a real JPG, PNG, or WebP image.";
  }

  return "";
};

export const validateImageFiles = (files, {
  minFiles = 0,
  maxFiles = MAX_PRODUCT_IMAGE_COUNT,
  maxSize = MAX_ADMIN_IMAGE_SIZE_BYTES,
} = {}) => {
  const normalizedFiles = Array.isArray(files) ? files.filter(Boolean) : [files].filter(Boolean);

  if (normalizedFiles.length < minFiles) {
    throw new Error(`A minimum of ${minFiles} images are required.`);
  }

  if (normalizedFiles.length > maxFiles) {
    throw new Error(`You can upload a maximum of ${maxFiles} images.`);
  }

  for (const file of normalizedFiles) {
    const message = getImageValidationMessage(file, { maxSize });
    if (message) throw new Error(message);
  }

  return true;
};
