import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Backend is running using GitHub Actions + test deployment! 🚀",
  });
});

app.listen(3001, () => {
  console.log(`🚀 Server running on port 3001`);
});
