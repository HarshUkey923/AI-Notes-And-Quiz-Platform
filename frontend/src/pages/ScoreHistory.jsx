import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import api from "../utils/api";

function ScoreBar({ pct, color = "brand" }) {
  const colors = {
    brand: "bg-brand-500",
    green: "bg-green-500",
    yellow: "bg-yellow-400",
    red: "bg-red-400",
  };
  const barColor =
    pct >= 80 ? colors.green : pct >= 50 ? colors.yellow : colors.red;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
      <span className="text-sm font-semibold w-10 text-right text-slate-700 dark:text-slate-300">
        {pct}%
      </span>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ pct }) {
  if (pct === 100) return <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 font-medium">Perfect ✨</span>;
  if (pct >= 80)  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 font-medium">Great 🎉</span>;
  if (pct >= 50)  return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-300 font-medium">OK 👍</span>;
  return           <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 font-medium">Retry 📚</span>;
}

const formatTime = (s) => {
  if (!s) return "—";
  return `${Math.floor(s / 60)}m ${s % 60}s`;
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function ScoreHistory() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/quiz/stats/summary")
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center gap-4">
        <Link to="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          ← Dashboard
        </Link>
        <span className="text-slate-300 dark:text-slate-700">|</span>
        <h1 className="font-semibold text-slate-900 dark:text-white flex-1">Score History</h1>
        <ThemeToggle />
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-5 animate-pulse h-20 bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : !stats || stats.totalQuizzes === 0 ? (
          <div className="card p-16 text-center text-slate-400 dark:text-slate-500">
            <p className="text-4xl mb-4">📊</p>
            <p className="font-medium">No quiz history yet.</p>
            <p className="text-sm mt-1">Take a quiz to start tracking your scores.</p>
            <Link to="/dashboard" className="btn-primary inline-block mt-6">Go to Dashboard</Link>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Quizzes taken" value={stats.totalQuizzes} />
              <StatCard label="Average score" value={`${stats.avgScore}%`} />
              <StatCard label="Best score" value={`${stats.bestScore}%`} />
              <StatCard
                label="Streak"
                value={`${stats.history.filter((h) => h.pct >= 50).length}`}
                sub="passing attempts"
              />
            </div>

            {/* Recent attempts */}
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Recent attempts</h2>
              <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                {stats.history.length === 0 ? (
                  <p className="p-5 text-slate-400 text-sm">No attempts yet.</p>
                ) : (
                  stats.history.slice().reverse().map((h, i) => (
                    <motion.div
                      key={h.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-4 flex items-center gap-4"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: h.pct >= 80 ? "#dcfce7" : h.pct >= 50 ? "#fef9c3" : "#fee2e2",
                                 color:      h.pct >= 80 ? "#15803d" : h.pct >= 50 ? "#854d0e" : "#b91c1c" }}>
                        {h.pct}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{h.note}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          {h.score}/{h.total} correct · {formatTime(h.timeTaken)} · {formatDate(h.date)}
                        </p>
                      </div>
                      <Badge pct={h.pct} />
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Score trend mini-chart */}
            {stats.history.length > 1 && (
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white mb-3">Score trend</h2>
                <div className="card p-5">
                  <div className="flex items-end gap-2 h-24">
                    {stats.history.map((h, i) => (
                      <div key={h.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div
                          className="absolute bottom-6 hidden group-hover:block bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs rounded px-2 py-1 whitespace-nowrap z-10"
                          style={{ bottom: `${(h.pct / 100) * 80 + 28}px` }}
                        >
                          {h.pct}% — {h.note.slice(0, 20)}{h.note.length > 20 ? "…" : ""}
                        </div>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(h.pct / 100) * 80}px` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                          className={`w-full rounded-t-sm ${
                            h.pct >= 80 ? "bg-green-400" : h.pct >= 50 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                        />
                        <span className="text-xs text-slate-300 dark:text-slate-600">{i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">Hover bars for details · Last {stats.history.length} attempts</p>
                </div>
              </div>
            )}

            {/* Per-note breakdown */}
            {stats.noteBreakdown.length > 0 && (
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white mb-3">By note</h2>
                <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.noteBreakdown
                    .sort((a, b) => b.attempts - a.attempts)
                    .map((n, i) => (
                      <div key={i} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate mr-4">{n.title}</p>
                          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-400 dark:text-slate-500">
                            <span>{n.attempts} attempt{n.attempts !== 1 ? "s" : ""}</span>
                            <span>Best: <span className="font-semibold text-slate-700 dark:text-slate-300">{n.best}%</span></span>
                          </div>
                        </div>
                        <ScoreBar pct={n.avg} />
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Average score</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

          </motion.div>
        )}
      </div>
    </div>
  );
}
