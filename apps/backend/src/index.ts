import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.route.js";
import projectRoutes from "./routes/project.route.js";
import { attachWebSocketServer } from "./ws/server.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "likeable-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);

const port = Number(process.env.PORT) || 3010;

const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(port, () => {
  console.log(`Likeable backend listening on http://localhost:${port} (HTTP + WS)`);
});
