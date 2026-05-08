import multer from "multer";

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

const createImageUpload = ({ fileSize = 1024 * 1024 * 5, files } = {}) =>
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
  fileSize: 1024 * 1024 * 5,
  files: 10,
});

export const uploadCategory = createImageUpload({
  fileSize: 1024 * 1024 * 5,
  files: 1,
});

export const uploadRental = createImageUpload({
  fileSize: 1024 * 1024 * 5,
  files: 10,
});
