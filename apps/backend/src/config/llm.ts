import { ChatOpenAI } from "@langchain/openai";

// Groq exposes an OpenAI-compatible endpoint, so the existing ChatOpenAI
// wrapper works unchanged — this keeps the agent on Groq's free tier instead
// of a paid OpenRouter model. Override via GROQ_MODEL if you want a
// different Groq-hosted model (must support tool calling).
export const llm = new ChatOpenAI({
  model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  temperature: 0.7,
  streaming: false,
  apiKey: process.env.GROQ_API_KEY || "",
  configuration: {
    baseURL: "https://api.groq.com/openai/v1",
  },
});
