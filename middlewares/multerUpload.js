import multer from "multer";
import path from "path";

const createStorage = (folderName) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, `public/images/${folderName}`);
    },
    filename: (req, file, cb) => {
      const identifier = req.session?.user || folderName;
      cb(null, `${identifier}-${Date.now()}${path.extname(file.originalname)}`);
    },
  });

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only images are allowed"), false);
  }
};

export const upload = multer({
  storage: createStorage("avatars"),
  fileFilter: imageFilter,
  limits: { fileSize: 1024 * 1024 * 2 },
});