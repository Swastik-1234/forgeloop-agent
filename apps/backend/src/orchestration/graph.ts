import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { getTools, type Emit } from "../tools/tool.js";
import { plan_prompt } from "../prompts/plan_prompt.js";
import { system_message } from "../prompts/system_message.js";
import { llm } from "../config/llm.js";
import { estimateTokens, recordUsage, waitForBudget } from "../config/rate-limiter.js";
import type { GraphState } from "../types/state.type.js";
import { StateAnnotation } from "../types/state.type.js";
import { MemorySaver } from "@langchain/langgraph";

const memorySaver = new MemorySaver();

const noopEmit: Emit = () => {};

// Two transient Groq/free-model quirks worth retrying instead of failing
// the whole run: (1) the free tier caps requests at 8000 tokens/minute
// account-wide, easy to hit mid-run; (2) smaller open-weight models
// occasionally emit malformed tool-call JSON that fails to parse — a
// one-off model hiccup, not a logic error, and usually succeeds on retry.
async function invokeWithRateLimitRetry<T>(
  fn: () => Promise<T>,
  emit: Emit,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const message: string = error?.message || String(error);
      const isRateLimit = error?.status === 429 || /rate limit/i.test(message);
      const isMalformedToolCall =
        error?.status === 400 && /parse tool call arguments/i.test(message);

      if ((!isRateLimit && !isMalformedToolCall) || attempt === maxRetries) {
        throw error;
      }

      let waitMs = 3000;
      if (isRateLimit) {
        const match = message.match(/try again in ([\d.]+)(ms|s|m)/i);
        waitMs = 15000;
        if (match && match[1] && match[2]) {
          const value = parseFloat(match[1]);
          const unit = match[2].toLowerCase();
          waitMs = unit === "ms" ? value : unit === "m" ? value * 60000 : value * 1000;
        }
        waitMs = Math.min(Math.max(waitMs, 2000), 60000) + 1000; // small buffer, capped
      }

      emit({
        e: "stage_update",
        stage: "executing",
        message: isRateLimit
          ? `Groq rate limit hit — waiting ${Math.round(waitMs / 1000)}s before retrying...`
          : "Model returned a malformed response — retrying...",
        progress: 40,
      });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error("Unreachable");
}

const COMPLETION_TOKEN_BUDGET = 1024; // matches llm's maxTokens

// Proactively paces calls to stay under Groq's free-tier 8000 tokens/min
// cap (estimate + wait before calling), then still falls back to the
// reactive retry above as a safety net for estimation error or other
// processes sharing the same account's quota.
async function callLLMWithBudget<T extends { content: unknown }>(
  fn: () => Promise<T>,
  inputText: string,
  emit: Emit
): Promise<T> {
  const estimatedInput = estimateTokens(inputText);
  await waitForBudget(estimatedInput + COMPLETION_TOKEN_BUDGET, (waitMs) => {
    emit({
      e: "stage_update",
      stage: "executing",
      message: `Pacing requests to stay within Groq's free-tier limit — waiting ${Math.round(waitMs / 1000)}s...`,
      progress: 40,
    });
  });

  const response = await invokeWithRateLimitRetry(fn, emit);

  const usage = (response as any).usage_metadata?.total_tokens;
  recordUsage(usage ?? estimatedInput + COMPLETION_TOKEN_BUDGET);

  return response;
}

export default async function createAgentGraph({
  projectId,
  model,
  emit,
}: {
  projectId: string;
  model: ChatOpenAI;
  emit?: Emit;
}) {
  const doEmit = emit || noopEmit;
  const tools = await getTools({ projectId, emit: doEmit });

  const modelWithTools = model.bindTools(tools);
  // system_message.ts previously wasn't wired into the graph at all — the
  // agent had zero instructions about the sandbox layout, available tools,
  // or design conventions, and would improvise inconsistently.
  const systemPrompt = system_message.replace("{{context}}", "");

  const plannerNode = async (state: GraphState) => {
    doEmit({ e: "stage_update", stage: "planning", message: "Creating a plan...", progress: 15 });

    const userMessages = state.messages.filter(
      (msg) => msg instanceof HumanMessage
    );
    const userRequest = userMessages
      .map((msg) => {
        const content = msg.content;
        return typeof content === "string" ? content : String(content);
      })
      .join("\n");

    const prompt = userRequest
      ? `${plan_prompt}\n\nUser's request: ${userRequest}`
      : plan_prompt;

    try {
      const response = await callLLMWithBudget(
        () => llm.invoke([new HumanMessage(prompt)]),
        prompt,
        doEmit
      );

      const planContent =
        typeof response.content === "string"
          ? response.content
          : String(response.content);
      const planSteps = planContent
        .split(/\n+/)
        .map((line) => line.replace(/^[\d\-\*•]\s*/, "").trim())
        .filter((line) => line.length > 0);

      doEmit({ e: "plan_generated", plan: planSteps });
      return { plan: planSteps };
    } catch (error: any) {
      doEmit({ e: "plan_error", message: error?.message || String(error) });
      throw error;
    }
  };

  const agentNode = async (state: GraphState) => {
    doEmit({ e: "stage_update", stage: "executing", message: "Working on it...", progress: 40 });
    doEmit({ e: "agent_thinking" });

    try {
      if (!state.messages || state.messages.length === 0) {
        throw new Error("No messages provided to agentNode");
      }

      const inputText =
        systemPrompt +
        state.messages
          .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
          .join("\n");

      const response = await callLLMWithBudget(
        () =>
          modelWithTools.invoke([
            new SystemMessage(systemPrompt),
            ...state.messages,
          ]),
        inputText,
        doEmit
      );

      if (!response) {
        throw new Error("Model returned undefined response");
      }

      const hasToolCalls =
        (response as AIMessage).tool_calls &&
        (response as AIMessage).tool_calls!.length > 0;

      if (!hasToolCalls) {
        const finalText =
          typeof response.content === "string"
            ? response.content
            : String(response.content);
        doEmit({ e: "agent_final_response", message: finalText });
      }

      return { messages: [response] };
    } catch (error: any) {
      console.error("Error in agentNode:", error);
      doEmit({ e: "agent_error", message: error?.message || String(error) });
      throw error;
    }
  };

  const toolNode = new ToolNode(tools);

  const shouldContinue = (state: GraphState) => {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

    if (state.messages.length > 200) {
      console.warn("Too many messages in state, stopping to prevent infinite loop");
      return "__end__";
    }

    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }

    return "__end__";
  };

  const workflow = new StateGraph(StateAnnotation)
    .addNode("planner", plannerNode)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)

    .addEdge("__start__", "planner")
    .addEdge("planner", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  return workflow.compile({ checkpointer: memorySaver });
}
