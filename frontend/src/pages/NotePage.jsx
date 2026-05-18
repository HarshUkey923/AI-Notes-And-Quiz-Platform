import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { marked } from "marked";
import api from "../utils/api";
import ThemeToggle from "../components/ThemeToggle.jsx";

marked.setOptions({ breaks: true, gfm: true });

const QUIZ_TIME = 120; // 2 minutes

export default function NotePage() {
  const { id } = useParams();
  const [note, setNote] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME);
  const [timerActive, setTimerActive] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [tab, setTab] = useState("summary"); // "summary" | "quiz"

  useEffect(() => {
    api.get(`/notes/${id}`).then((res) => setNote(res.data.note)).catch(() => toast.error("Note not found"));
  }, [id]);

  // Quiz timer
  useEffect(() => {
    if (!timerActive) return;
    if (timeLeft === 0) { handleSubmit(); return; }
    const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [timerActive, timeLeft]);

  const handleSummarize = async () => {
    setLoadingSummary(true);
    try {
      const { data } = await api.post(`/notes/${id}/summarize`);
      setNote((prev) => ({ ...prev, summary: data.summary }));
      setTab("summary");
      toast.success("Summary generated!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Summarization failed");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setLoadingQuiz(true);
    setResult(null);
    setAnswers({});
    setQuiz(null);
    try {
      const { data } = await api.post(`/quiz/generate/${id}`);
      setQuiz(data.quiz);
      setTimeLeft(QUIZ_TIME);
      setTimerActive(true);
      setTab("quiz");
      toast.success("Quiz ready!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Quiz generation failed");
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    setTimerActive(false);
    try {
      const { data } = await api.post(`/quiz/${quiz._id}/submit`, {
        answers,
        timeTaken: QUIZ_TIME - timeLeft,
      });
      setResult(data);
      toast.success(`Score: ${data.score}/${data.total}`);
    } catch {
      toast.error("Submit failed");
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!note) return (
    <div className="min-h-screen flex items-center justify-center text-slate-400 dark:bg-slate-950">Loading...</div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center gap-4">
        <Link to="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          ← Dashboard
        </Link>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <h1 className="font-semibold text-slate-900 dark:text-white truncate flex-1">{note.title}</h1>
        <ThemeToggle />
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Action buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleSummarize}
            disabled={loadingSummary}
            className="btn-primary"
          >
            {loadingSummary ? "Summarizing..." : note.summary ? "Re-summarize" : "✨ Summarize"}
          </button>
          <button
            onClick={handleGenerateQuiz}
            disabled={loadingQuiz || !note.summary}
            className="btn-secondary"
            title={!note.summary ? "Summarize first" : ""}
          >
            {loadingQuiz ? "Generating..." : "🧠 Generate Quiz"}
          </button>
        </div>

        {/* Tabs */}
        {(note.summary || quiz) && (
          <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
            {["summary", "quiz"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  tab === t
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Summary Tab */}
        {tab === "summary" && note.summary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Summary</h2>
            <div
              className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: marked.parse(note.summary) }}
            />
          </motion.div>
        )}

        {/* Quiz Tab */}
        {tab === "quiz" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loadingQuiz && !quiz && (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="card p-5 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {quiz && (<>
            {/* Timer & progress */}
            {!result && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {Object.keys(answers).length}/{quiz.questions.length} answered
                </p>
                <div className={`font-mono font-medium text-sm px-3 py-1 rounded-full ${
                  timeLeft < 30
                    ? "bg-red-50 dark:bg-red-900/20 text-red-600"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}>
                  ⏱ {formatTime(timeLeft)}
                </div>
              </div>
            )}

            {result ? (
              <div className="space-y-4">
                {/* Score card */}
                <div className="card p-6 text-center">
                  <div className="text-5xl font-bold text-brand-600 mb-2">
                    {result.score}/{result.total}
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mb-2">
                    {Math.round((result.score / result.total) * 100)}% correct
                  </p>
                  {result.timeTaken && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                      Completed in {formatTime(result.timeTaken)}
                    </p>
                  )}
                  <button onClick={handleGenerateQuiz} disabled={loadingQuiz} className="btn-primary">
                    {loadingQuiz ? "Generating new quiz..." : "Try Again"}
                  </button>
                </div>

                {/* Answer review */}
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 px-1">Answer review</p>
                {quiz.questions.map((q, i) => {
                  const userAnswer = answers[String(i)];
                  const isCorrect = userAnswer === q.answer;
                  return (
                    <div key={i} className={`card p-5 border-l-4 ${isCorrect ? "border-l-green-400" : "border-l-red-400"}`}>
                      <p className="font-medium text-slate-900 dark:text-white mb-3">
                        <span className="text-brand-600 mr-2">{i + 1}.</span>
                        {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const isCorrectOpt = opt === q.answer;
                          const isUserWrong = opt === userAnswer && !isCorrect;
                          return (
                            <div
                              key={opt}
                              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border flex items-center justify-between ${
                                isCorrectOpt
                                  ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium"
                                  : isUserWrong
                                  ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                                  : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {opt}
                              {isCorrectOpt && <span className="text-green-600 dark:text-green-400 text-xs font-semibold">✓ Correct</span>}
                              {isUserWrong && <span className="text-red-500 dark:text-red-400 text-xs font-semibold">✗ Your answer</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {quiz.questions.map((q, i) => (
                  <div key={i} className="card p-5">
                    <p className="font-medium text-slate-900 dark:text-white mb-3">
                      <span className="text-brand-600 mr-2">{i + 1}.</span>
                      {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setAnswers((prev) => ({ ...prev, [i]: opt }))}
                          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all ${
                            answers[i] === opt
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium"
                              : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < quiz.questions.length}
                  className="btn-primary w-full"
                >
                  Submit Quiz
                </button>
              </div>
            )}
          </>)}
          </motion.div>
        )}
      </div>
    </div>
  );
}
