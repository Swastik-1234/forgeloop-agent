import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { getTools, type Emit } from "../tools/tool.js";
import { plan_prompt } from "../prompts/plan_prompt.js";
import { system_message } from "../prompts/system_message.js";
import { llm } from "../config/llm.js";
import type { GraphState } from "../types/state.type.js";
import { StateAnnotation } from "../types/state.type.js";
import { MemorySaver } from "@langchain/langgraph";

const memorySaver = new MemorySaver();

const noopEmit: Emit = () => {};

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
      const response = await llm.invoke([new HumanMessage(prompt)]);

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

      const response = await modelWithTools.invoke([
        new SystemMessage(systemPrompt),
        ...state.messages,
      ]);

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
