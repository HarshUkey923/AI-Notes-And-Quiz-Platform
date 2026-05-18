const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "notes",
    resource_type: "raw",          // required for non-image files like PDFs
    allowed_formats: ["pdf"],
    public_id: (req, file) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      return `${unique}-${file.originalname.replace(/\.pdf$/i, "")}`;
    },
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  },
});

module.exports = { upload, cloudinary };