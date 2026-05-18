const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true },
  fileUrl: { type: String, required: true },
  publicId: { type: String }, // Cloudinary public_id for deletion
  extractedText: { type: String },
  summary: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Note", noteSchema);
