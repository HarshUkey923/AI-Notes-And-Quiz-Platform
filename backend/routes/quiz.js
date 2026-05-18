const express = require("express");
const fetch = require("node-fetch");
const auth = require("../middleware/auth");
const Note = require("../models/Note");
const Quiz = require("../models/Quiz");

const router = express.Router();

// GET /api/quiz/stats/summary  — must come BEFORE /:id routes
router.get("/stats/summary", auth, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ userId: req.userId, score: { $ne: null } })
      .populate("noteId", "title")
      .sort({ createdAt: -1 });

    // Filter out any orphaned quizzes whose note was deleted before this fix
    const valid = quizzes.filter((q) => q.noteId != null);
    const total = valid.length;

    const avgScore = total
      ? Math.round(
          (valid.reduce((acc, q) => acc + q.score / q.questions.length, 0) / total) * 100
        )
      : 0;

    const bestScore = total
      ? Math.round(Math.max(...valid.map((q) => (q.score / q.questions.length) * 100)))
      : 0;

    // Last 10 attempts for history chart
    const history = valid.slice(0, 10).reverse().map((q) => ({
      id: q._id,
      note: q.noteId.title,
      score: q.score,
      total: q.questions.length,
      pct: Math.round((q.score / q.questions.length) * 100),
      timeTaken: q.timeTaken,
      date: q.createdAt,
    }));

    // Per-note breakdown
    const byNote = {};
    valid.forEach((q) => {
      const key = q.noteId._id.toString();
      const title = q.noteId.title;
      if (!byNote[key]) byNote[key] = { title, attempts: 0, totalPct: 0, best: 0 };
      const pct = Math.round((q.score / q.questions.length) * 100);
      byNote[key].attempts++;
      byNote[key].totalPct += pct;
      byNote[key].best = Math.max(byNote[key].best, pct);
    });
    const noteBreakdown = Object.values(byNote).map((n) => ({
      ...n,
      avg: Math.round(n.totalPct / n.attempts),
    }));

    res.json({ totalQuizzes: total, avgScore, bestScore, history, noteBreakdown });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/quiz/generate/:noteId
router.post("/generate/:noteId", auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.noteId, userId: req.userId });
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (!note.extractedText)
      return res.status(400).json({ message: "Please summarize this note first to extract text" });

    const prompt = `Based on the following text, generate exactly 10 multiple-choice quiz questions. Randomly choose any 10 topics to generate questions on.
    Try to generate a different set of questions from the previous one.
Return ONLY a valid JSON object with a single key "questions" containing an array.
Each item must have: "question" (string), "options" (array of exactly 4 distinct strings), "answer" (string matching one of the options exactly).

Text:
${note.extractedText.slice(0, 6000)}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    const groqData = await groqRes.json();
    let rawText = groqData.choices?.[0]?.message?.content || "";

    // Strip markdown fences just in case
    rawText = rawText.replace(/```json|```/g, "").trim();

    let questions;
    try {
      const parsed = JSON.parse(rawText);
      questions = Array.isArray(parsed) ? parsed : parsed.questions;
      if (!Array.isArray(questions)) throw new Error("No questions array found");
    } catch {
      return res.status(500).json({ message: "Failed to parse quiz from AI response", raw: rawText });
    }

    const quiz = await Quiz.create({ userId: req.userId, noteId: note._id, questions });
    res.status(201).json({ quiz });
  } catch (err) {
    res.status(500).json({ message: "Quiz generation failed", error: err.message });
  }
});

// POST /api/quiz/:id/submit
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const { answers, timeTaken } = req.body;
    // answers: object keyed by question index e.g. { "0": "Paris", "1": "Newton" }
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[String(i)] === q.answer) score++;
    });

    quiz.score = score;
    quiz.timeTaken = timeTaken || null;
    await quiz.save();

    res.json({ score, total: quiz.questions.length, timeTaken });
  } catch (err) {
    res.status(500).json({ message: "Submit failed" });
  }
});

// GET /api/quiz/note/:noteId
router.get("/note/:noteId", auth, async (req, res) => {
  try {
    const quizzes = await Quiz.find({ noteId: req.params.noteId, userId: req.userId }).sort({
      createdAt: -1,
    });
    res.json({ quizzes });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
