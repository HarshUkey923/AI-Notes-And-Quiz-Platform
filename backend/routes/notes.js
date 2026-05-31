const express = require("express");
const pdf = require("pdf-parse");
const fetch = require("node-fetch");
const auth = require("../middleware/auth");
const { upload, cloudinary } = require("../config/cloudinary");
const Note = require("../models/Note");
const Quiz = require("../models/Quiz");

const router = express.Router();

// POST /api/notes/upload
router.post("/upload", auth, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const note = await Note.create({
      userId: req.userId,
      title: req.body.title || req.file.originalname.replace(/\.pdf$/i, ""),
      fileUrl: req.file.path,         // Cloudinary URL
      publicId: req.file.filename,    // Cloudinary public_id
    });

    res.status(201).json({ note });
  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// GET /api/notes
router.get("/", auth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.userId }).sort({ uploadedAt: -1 });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/notes/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ message: "Note not found" });
    res.json({ note });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/notes/:id/summarize
router.post("/:id/summarize", auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ message: "Note not found" });

    // Fetch PDF from Cloudinary URL
    const pdfResponse = await fetch(note.fileUrl);
    if (!pdfResponse.ok)
      return res.status(502).json({ message: "Failed to fetch PDF from Cloudinary" });

    const pdfBuffer = await pdfResponse.buffer();
    const pdfData = await pdf(pdfBuffer);
    const fullText = pdfData.text || "";

    if (!fullText || fullText.trim().length === 0)
      return res.status(400).json({ message: "Could not extract text. Make sure the PDF is not a scanned image." });

    // Split into pages — pdf-parse separates pages with form feed (\f)
    const pageTexts = fullText
      .split(/\f/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    const trimmedText = fullText.slice(0, 30000);

    // Call Groq API
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{
          role: "user",
          content: `Summarize the following text in clear, concise bullet points. 
          Focus on covering every concept and topic. Ignore irrelevant content like course information, introduction and author. 
          Format as markdown:\n\n${trimmedText}`,
        }],
      }),
    });

    const groqData = await groqRes.json();
    const summary = groqData.choices?.[0]?.message?.content;
    if (!summary) return res.status(500).json({ message: "Groq returned no summary", detail: groqData });

    note.extractedText = trimmedText;
    note.pageTexts = pageTexts;
    note.summary = summary;
    await note.save();
    console.log(`Saved ${pageTexts.length} page segments for note ${note._id}`);

    res.json({ summary });
  } catch (err) {
    console.error("Summarize error:", err);
    res.status(500).json({ message: "Summarization failed", error: err.message });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ message: "Note not found" });

    if (note.publicId) {
      await cloudinary.uploader.destroy(note.publicId, { resource_type: "raw" });
    }

    await Quiz.deleteMany({ noteId: note._id });
    res.json({ message: "Note deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;