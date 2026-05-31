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

    const history = valid.slice(0, 10).reverse().map((q) => ({
      id: q._id,
      note: q.noteId.title,
      score: q.score,
      total: q.questions.length,
      pct: Math.round((q.score / q.questions.length) * 100),
      timeTaken: q.timeTaken,
      date: q.createdAt,
    }));

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

    const TOTAL_QUESTIONS = 10;
    let segments = [];

    if (note.pageTexts && note.pageTexts.length >= TOTAL_QUESTIONS) {
      // Group pages into equal buckets
      const totalPages = note.pageTexts.length;
      const pagesPerGroup = Math.ceil(totalPages / TOTAL_QUESTIONS);
      for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        const start = i * pagesPerGroup;
        const end = Math.min(start + pagesPerGroup, totalPages);
        const segment = note.pageTexts.slice(start, end).join(" ").trim();
        if (segment.length > 30) segments.push(segment);
      }
    } else {
      // Fallback: split full text into equal char chunks
      const text = note.extractedText;
      const chunkSize = Math.floor(text.length / TOTAL_QUESTIONS);
      for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        const start = i * chunkSize;
        const end = i === TOTAL_QUESTIONS - 1 ? text.length : start + chunkSize;
        const segment = text.slice(start, end).trim();
        if (segment.length > 30) segments.push(segment);
      }
    }

    // Send in batches of 3 to stay under Groq's TPM rate limit
    const BATCH_SIZE = 3;
    const BATCH_DELAY = 2500; // ms between batches

    const callGroq = (segment) =>
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{
            role: "user",
            content: `Based ONLY on the text below, write exactly 1 multiple-choice question about a specific fact or concept in this text.
Return ONLY a valid JSON object with these exact top-level keys:
- "question": string
- "options": array of exactly 4 distinct strings
- "answer": one of the options exactly as written

Text:
${segment.slice(0, 2000)}`,
          }],
          response_format: { type: "json_object" },
        }),
      })
        .then((r) => r.json())
        .catch(() => null);

    const allResults = [];
    for (let i = 0; i < segments.length; i += BATCH_SIZE) {
      const batch = segments.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(callGroq));
      allResults.push(...batchResults);
      if (i + BATCH_SIZE < segments.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY));
      }
    }

    const questions = allResults
      .map((r, i) => {
        if (!r) return null;
        if (r.error) {
          console.log(`Segment ${i} Groq error:`, r.error.message);
          return null;
        }
        try {
          const content = r.choices?.[0]?.message?.content;
          if (!content) return null;
          const parsed = JSON.parse(content);

          // Shape 1: top-level { question, options, answer }  ← what Groq actually returns
          if (
            typeof parsed.question === "string" &&
            Array.isArray(parsed.options) &&
            parsed.options.length === 4 &&
            typeof parsed.answer === "string"
          ) {
            return parsed;
          }

          // Shape 2: nested under "question" key
          const nested = parsed.question;
          if (
            nested &&
            typeof nested === "object" &&
            typeof nested.question === "string" &&
            Array.isArray(nested.options) &&
            nested.options.length === 4 &&
            typeof nested.answer === "string"
          ) {
            return nested;
          }

          // Shape 3: inside "questions" array
          const first = parsed.questions?.[0];
          if (
            first &&
            typeof first.question === "string" &&
            Array.isArray(first.options) &&
            first.options.length === 4 &&
            typeof first.answer === "string"
          ) {
            return first;
          }

          console.log(`Segment ${i} unexpected shape:`, JSON.stringify(parsed).slice(0, 200));
          return null;
        } catch (e) {
          console.log(`Segment ${i} parse error:`, e.message);
          return null;
        }
      })
      .filter(Boolean);

    if (questions.length === 0) {
      const sample = allResults[0];
      return res.status(500).json({
        message: "Failed to generate any questions",
        groqError: sample?.error || null,
        groqContent: sample?.choices?.[0]?.message?.content || null,
        segmentCount: segments.length,
        pageTextsCount: note.pageTexts?.length || 0,
      });
    }

    const quiz = await Quiz.create({ userId: req.userId, noteId: note._id, questions });
    res.status(201).json({ quiz });
  } catch (err) {
    console.error("Quiz generation error:", err);
    res.status(500).json({ message: "Quiz generation failed", error: err.message });
  }
});

// POST /api/quiz/:id/submit
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const { answers, timeTaken } = req.body;
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