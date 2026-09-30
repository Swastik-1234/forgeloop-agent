import type { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { HumanMessage } from "@langchain/core/messages";
import { prisma } from "../lib/prisma.js";
import { llm } from "../config/llm.js";
import createAgentGraph from "../orchestration/graph.js";
import type { Emit } from "../tools/tool.js";

function parseTokenFromCookieHeader(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "token") return rest.join("=");
  }
  return null;
}

function safeSend(ws: WebSocket, event: Record<string, any>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function attachWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const projectId = url.searchParams.get("projectId");
    const queryToken = url.searchParams.get("token");
    const cookieToken = parseTokenFromCookieHeader(req.headers.cookie);
    const token = cookieToken || queryToken;

    if (!projectId) {
      ws.close(4000, "Invalid project ID");
      return;
    }

    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as { id: string };
      userId = decoded.id;
    } catch {
      ws.close(4001, "Authentication required");
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId, userId } });
    if (!project) {
      ws.close(4003, "Access denied to this project");
      return;
    }

    safeSend(ws, { e: "connected", authenticated: true });

    ws.on("message", async (raw) => {
      let parsed: any;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        safeSend(ws, { e: "error", message: "Invalid message format" });
        return;
      }

      if (parsed.type === "ping") {
        safeSend(ws, { e: "pong" });
        return;
      }

      if (parsed.type === "start_agent") {
        const prompt = typeof parsed.prompt === "string" ? parsed.prompt.trim() : "";
        if (!prompt) {
          safeSend(ws, { e: "error", message: "Prompt is required" });
          return;
        }

        const emit: Emit = (event) => safeSend(ws, event);

        try {
          emit({ e: "agent_started", message: "Starting to process your request..." });
          emit({ e: "stage_update", stage: "initializing", message: "Setting up...", progress: 5 });

          const graph = await createAgentGraph({ projectId, model: llm, emit });

          emit({ e: "stage_update", stage: "verifying", message: "Wrapping up...", progress: 90 });

          await graph.invoke(
            { messages: [new HumanMessage(prompt)], projectId, plan: [] },
            {
              configurable: { thread_id: projectId },
              recursionLimit: 100,
            }
          );

          emit({ e: "agent_completed" });
          emit({ e: "stage_update", stage: "complete", message: "Done", progress: 100 });
        } catch (error: any) {
          console.error("Agent execution failed:", error);
          emit({ e: "agent_error", message: error?.message || String(error) });
          emit({ e: "stage_error", message: error?.message || "Agent execution failed" });
        }
        return;
      }

      safeSend(ws, { e: "error", message: `Unknown message type: ${parsed.type}` });
    });
  });

  return wss;
}
