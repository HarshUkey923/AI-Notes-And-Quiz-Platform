const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  answer: String,
});

const quizSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  noteId: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
  questions: [questionSchema],
  score: { type: Number, default: null },
  timeTaken: { type: Number, default: null }, // seconds
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Quiz", quizSchema);
