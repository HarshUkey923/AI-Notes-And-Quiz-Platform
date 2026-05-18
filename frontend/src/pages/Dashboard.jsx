import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import api from "../utils/api";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0 });
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetchNotes();
    fetchStats();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data } = await api.get("/notes");
      setNotes(data.notes);
    } catch {
      toast.error("Failed to load notes");
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get("/quiz/stats/summary");
      setStats(data);
    } catch {}
  };

  const handleUpload = async (file) => {
    if (!file || file.type !== "application/pdf") {
      toast.error("Please select a PDF file");
      return;
    }
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("title", title || file.name.replace(".pdf", ""));

    setUploading(true);
    try {
      const { data } = await api.post("/notes/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setNotes((prev) => [data.note, ...prev]);
      setTitle("");
      toast.success("Note uploaded!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this note?")) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n._id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Navbar */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">NoteAI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">{user?.name}</span>
          <Link to="/scores" className="btn-secondary text-sm py-1.5">📊 Scores</Link>
          <ThemeToggle />
          <button onClick={logout} className="btn-secondary text-sm py-1.5">Sign out</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Notes uploaded", value: notes.length },
            { label: "Quizzes taken", value: stats.totalQuizzes },
            { label: "Avg. score", value: `${stats.avgScore}%` },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Upload Area */}
        <div className="card p-6 mb-8">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Upload a PDF</h2>
          <input
            type="text"
            className="input mb-3"
            placeholder="Note title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20"
                : "border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-600"
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {uploading ? "Uploading..." : "Drop PDF here or click to browse"}
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files[0])}
          />
        </div>

        {/* Notes Grid */}
        <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Your Notes ({notes.length})</h2>
        {notes.length === 0 ? (
          <div className="card p-12 text-center text-slate-400 dark:text-slate-500">
            <p>No notes yet. Upload your first PDF above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {notes.map((note) => (
                <motion.div
                  key={note._id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <button
                      onClick={() => handleDelete(note._id)}
                      className="text-slate-300 dark:text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="font-medium text-slate-900 dark:text-white text-sm mb-1 line-clamp-2">{note.title}</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                    {new Date(note.uploadedAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-1">
                    {note.summary && (
                      <span className="text-xs bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">Summarized</span>
                    )}
                  </div>
                  <Link
                    to={`/notes/${note._id}`}
                    className="mt-3 block btn-primary text-sm text-center py-1.5"
                  >
                    Open →
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
