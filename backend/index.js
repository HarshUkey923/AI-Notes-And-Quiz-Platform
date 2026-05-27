const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const app = express();

if (process.env.NODE_ENV !== "production") {
  app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
}

app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/notes", require("./routes/notes"));
app.use("/api/quiz", require("./routes/quiz"));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Serve React build in production
if (process.env.NODE_ENV === "production") {
  // Try __dirname/public first, then fall back to sibling client/dist
  const candidates = [
    path.join(__dirname, "public"),
    path.join(__dirname, "../frontend/dist"),
  ];
  const clientBuild = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));

  if (clientBuild) {
    console.log("Serving static files from:", clientBuild);
    app.use(express.static(clientBuild));
    app.get("*", (req, res) => res.sendFile(path.join(clientBuild, "index.html")));
  } else {
    console.error("Could not find React build. Tried:", candidates);
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => console.error("MongoDB connection error:", err));
