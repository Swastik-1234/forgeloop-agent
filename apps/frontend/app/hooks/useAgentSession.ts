"use client";

import { useCallback, useState } from "react";
import { createConversationMessage } from "@/app/lib/api";

export type ConversationMessageType = "TEXT_MESSAGE" | "TOOL_CALL" | "ERROR_MESSAGE";

export type ConversationMessageFrom = "USER" | "AGENT";

export interface AgentChatMessage {
  id: string;
  from: ConversationMessageFrom;
  contents: string;
  type: ConversationMessageType;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface StageInfo {
  stage: string;
  message: string;
  progress: number;
  currentStep?: number;
  totalSteps?: number;
}

interface WebSocketEvent {
  e: string;
  [key: string]: any;
}

type ToolCall =
  | "CREATE_FILE"
  | "READ_FILE"
  | "DELETE_FILE"
  | "EXECUTE_COMMAND"
  | "RENAME_FILE"
  | "LIST_DIRECTORIES"
  | "GET_CONTEXT"
  | "SAVE_CONTEXT"
  | "TEST_BUILD"
  | "WRITE_MULTIPLE_FILES"
  | "CHECK_MISSING_DEPENDENCIES"
  | "ADD_DEPENDENCY";

interface FormattedAgentEvent {
  contents: string;
  type: ConversationMessageType;
  metadata?: Record<string, unknown>;
  toolCall?: ToolCall;
}

// Map tool names from backend to frontend enum values
const TOOL_NAME_MAP: Record<string, ToolCall> = {
  // File operations
  write: "CREATE_FILE",
  "write-multiple-files": "WRITE_MULTIPLE_FILES",
  read: "READ_FILE",
  "delete-file": "DELETE_FILE",
  "rename-file": "RENAME_FILE",
  "list-directories": "LIST_DIRECTORIES",
  // Command execution
  "execute-command": "EXECUTE_COMMAND",
  // Dependency management
  "add-dependency": "ADD_DEPENDENCY",
  // Context management
  get_context: "GET_CONTEXT",
  save_context: "SAVE_CONTEXT",
  // Build & verification
  "test-build": "TEST_BUILD",
  "check-missing-dependencies": "CHECK_MISSING_DEPENDENCIES",
};

// Tools that should be displayed to the user
const VISIBLE_TOOL_NAMES = new Set<ToolCall>([
  "CREATE_FILE",
  "WRITE_MULTIPLE_FILES",
  "DELETE_FILE",
  "RENAME_FILE",
  "ADD_DEPENDENCY",
  "EXECUTE_COMMAND",
  "TEST_BUILD",
  "CHECK_MISSING_DEPENDENCIES",
]);

const shouldDisplayToolEvent = (toolName?: string) => {
  if (!toolName) return false;
  const mapped = TOOL_NAME_MAP[toolName];
  if (!mapped) return false;
  return VISIBLE_TOOL_NAMES.has(mapped);
};

const truncate = (value: string, length = 500) =>
  value.length > length ? `${value.slice(0, length)}…` : value;

const formatPlan = (plan?: string[]) => {
  if (!plan || plan.length === 0) return null;
  return plan.map((step, idx) => `${idx + 1}. ${step}`).join("\n");
};

// Human-readable stage names
const STAGE_LABELS: Record<string, string> = {
  initializing: "Initializing",
  ingest: "Loading Context",
  planning: "Creating Plan",
  executing: "Executing Plan",
  verifying: "Verifying Build",
  finalizing: "Wrapping Up",
  complete: "Complete",
  error: "Error",
};

const formatAgentEvent = (event: WebSocketEvent): FormattedAgentEvent | null => {
  switch (event.e) {
    // Connection events
    case "connected": {
      return {
        type: "TEXT_MESSAGE",
        contents: `Connected to project${event.authenticated ? " (authenticated)" : ""}`,
      };
    }

    // Stage updates - don't create messages for these, they're handled separately
    case "stage_update":
    case "stage_error":
      return null;

    // Plan events
    case "plan_generated": {
      const planText = formatPlan(event.plan);
      return {
        type: "TEXT_MESSAGE",
        contents: planText
          ? `Plan generated:\n${planText}`
          : event.message || "Plan generated successfully.",
      };
    }
    case "plan_error": {
      return {
        type: "ERROR_MESSAGE",
        contents: event.message || "Failed to generate plan.",
      };
    }

    // Agent status events
    case "agent_started": {
      return {
        type: "TEXT_MESSAGE",
        contents: event.message || "Starting to process your request...",
      };
    }
    case "agent_thinking": {
      return {
        type: "TEXT_MESSAGE",
        contents: event.message || "Thinking...",
      };
    }
    case "agent_completed": {
      return null; // Don't show completion message, final response will be shown
    }
    case "agent_response":
    case "agent_final_response": {
      if (!event.message) return null;
      return {
        type: "TEXT_MESSAGE",
        contents: event.message,
      };
    }
    case "agent_error": {
      return {
        type: "ERROR_MESSAGE",
        contents: event.message || "Agent encountered an error.",
      };
    }

    // Step completion events
    case "step_completed": {
      return {
        type: "TEXT_MESSAGE",
        contents: `✓ ${event.step}${event.remainingSteps > 0 ? ` (${event.remainingSteps} steps remaining)` : ""}`,
      };
    }

    // Graph node updates (for streaming)
    case "graph_node_update": {
      return null;
    }

    // Tool events
    case "tool_started": {
      const tool = event.tool || "tool";
      if (!shouldDisplayToolEvent(tool)) {
        return null;
      }
      const toolLabel = tool.replace(/-/g, " ");
      return {
        type: "TOOL_CALL",
        contents: `Running: ${toolLabel}...`,
        toolCall: TOOL_NAME_MAP[tool],
        metadata: { tool, input: event.input },
      };
    }
    case "tool_completed": {
      const tool = event.tool || "tool";
      if (!shouldDisplayToolEvent(tool)) {
        return null;
      }
      const toolLabel = tool.replace(/-/g, " ");
      return {
        type: "TOOL_CALL",
        contents: `✓ ${toolLabel} completed`,
        toolCall: TOOL_NAME_MAP[tool],
        metadata: { tool, output: event.output },
      };
    }
    case "tool_error": {
      const tool = event.tool || "tool";
      return {
        type: "ERROR_MESSAGE",
        contents: `✗ ${tool} failed: ${event.error || "Unknown error"}`,
        toolCall: TOOL_NAME_MAP[tool],
        metadata: { tool, error: event.error },
      };
    }

    // Dependency events
    case "dependency_installation_started": {
      return {
        type: "TEXT_MESSAGE",
        contents: event.message || "Installing dependency...",
        toolCall: "ADD_DEPENDENCY",
      };
    }
    case "dependency_installation_completed": {
      return {
        type: "TEXT_MESSAGE",
        contents: event.message || "✓ Dependency installed.",
        toolCall: "ADD_DEPENDENCY",
      };
    }
    case "dependency_error": {
      return {
        type: "ERROR_MESSAGE",
        contents: event.message || "Dependency installation failed.",
        toolCall: "ADD_DEPENDENCY",
      };
    }

    // Verification events
    case "verification_result": {
      const status = event.status || "info";
      const message = event.message || "Verification update.";
      // Only show short status messages, not full build output
      return {
        type: status === "failure" || status === "error" ? "ERROR_MESSAGE" : "TEXT_MESSAGE",
        contents: message,
        metadata: { status },
      };
    }

    // Sandbox events
    case "sandbox_created": {
      return {
        type: "TEXT_MESSAGE",
        contents: "✓ Development environment ready",
      };
    }

    // File events (informational)
    case "file_created": {
      return {
        type: "TEXT_MESSAGE",
        contents: `✓ Created: ${event.filepath || "file"}`,
        toolCall: "CREATE_FILE",
      };
    }
    case "files_created": {
      const count = event.files?.length || event.count || 0;
      return {
        type: "TEXT_MESSAGE",
        contents: `✓ Created ${count} files`,
        toolCall: "WRITE_MULTIPLE_FILES",
      };
    }
    case "file_deleted": {
      return {
        type: "TEXT_MESSAGE",
        contents: `✓ Deleted: ${event.filepath || "file"}`,
        toolCall: "DELETE_FILE",
      };
    }
    case "file_renamed": {
      return {
        type: "TEXT_MESSAGE",
        contents: `✓ Renamed: ${event.oldPath || "file"} → ${event.newPath || "new location"}`,
        toolCall: "RENAME_FILE",
      };
    }

    // Build events
    case "build_started": {
      return {
        type: "TEXT_MESSAGE",
        contents: "Building project...",
        toolCall: "TEST_BUILD",
      };
    }
    case "build_test_success": {
      return {
        type: "TEXT_MESSAGE",
        contents: "✓ Build successful!",
        toolCall: "TEST_BUILD",
      };
    }
    case "build_test_failed":
    case "build_test_error": {
      return {
        type: "ERROR_MESSAGE",
        contents: `✗ Build failed: ${event.message || event.error || "Unknown error"}`,
        toolCall: "TEST_BUILD",
      };
    }

    // Context events - don't show these to user
    case "context_loaded":
    case "context_saved": {
      return null;
    }

    // General error
    case "error": {
      return {
        type: "ERROR_MESSAGE",
        contents: event.message || "An error occurred.",
      };
    }

    // Ping/pong (ignore)
    case "pong":
      return null;

    default:
      // Log unknown events for debugging
      console.log("Unknown WebSocket event:", event.e, event);
      return null;
  }
};

const buildMessage = (
  from: ConversationMessageFrom,
  type: ConversationMessageType,
  contents: string,
  metadata?: Record<string, unknown>
): AgentChatMessage => ({
  id:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
  from,
  type,
  contents,
  createdAt: new Date().toISOString(),
  ...(metadata ? { metadata } : {}),
});

export function useAgentSession(projectId: string) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [planSteps, setPlanSteps] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);

  const appendMessage = useCallback((message: AgentChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const persistMessage = useCallback(
    async (message: AgentChatMessage, toolCall?: ToolCall) => {
      try {
        await createConversationMessage(
          projectId,
          message.contents,
          message.type,
          message.from,
          toolCall
        );
      } catch (error) {
        console.error("Failed to persist conversation message", error);
      }
    },
    [projectId]
  );

  const sendUserMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      const message = buildMessage("USER", "TEXT_MESSAGE", trimmed);
      appendMessage(message);
      setIsProcessing(true);
      setStageInfo({
        stage: "initializing",
        message: "Starting...",
        progress: 0,
      });
      await persistMessage(message);
    },
    [appendMessage, persistMessage]
  );

  const handleAgentEvent = useCallback(
    async (event: WebSocketEvent) => {
      // Handle stage updates
      if (event.e === "stage_update") {
        setStageInfo({
          stage: event.stage,
          message: event.message,
          progress: event.progress || 0,
          currentStep: event.currentStep,
          totalSteps: event.totalSteps,
        });
        
        // Mark processing complete when stage is complete
        if (event.stage === "complete") {
          setIsProcessing(false);
        }
        return;
      }

      if (event.e === "stage_error") {
        setStageInfo({
          stage: "error",
          message: event.message,
          progress: 0,
        });
        setIsProcessing(false);
        return;
      }

      // Track processing state
      if (event.e === "agent_started") {
        setIsProcessing(true);
      } else if (
        event.e === "agent_completed" ||
        event.e === "agent_final_response" ||
        event.e === "agent_error"
      ) {
        // Don't immediately set processing to false - wait for stage_update
        if (event.e === "agent_error") {
          setIsProcessing(false);
          setStageInfo(null);
        }
      }

      // Update plan steps
      if (event.e === "plan_generated" && Array.isArray(event.plan)) {
        setPlanSteps(event.plan);
      } else if (event.e === "step_completed" && event.remainingSteps !== undefined) {
        setPlanSteps((prev) => prev.slice(1));
      }

      const formatted = formatAgentEvent(event);
      if (!formatted) return;

      const message = buildMessage(
        "AGENT",
        formatted.type,
        formatted.contents,
        formatted.metadata
      );
      appendMessage(message);
      await persistMessage(message, formatted.toolCall);
    },
    [appendMessage, persistMessage]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPlanSteps([]);
    setIsProcessing(false);
    setStageInfo(null);
  }, []);

  // Get human-readable stage label
  const stageLabel = stageInfo?.stage ? STAGE_LABELS[stageInfo.stage] || stageInfo.stage : null;

  return {
    messages,
    sendUserMessage,
    handleAgentEvent,
    planSteps,
    isProcessing,
    stageInfo,
    stageLabel,
    clearMessages,
  };
}
