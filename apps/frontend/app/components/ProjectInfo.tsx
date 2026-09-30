"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AgentChatMessage } from "@/app/hooks/useAgentSession";

interface ProjectInfoProps {
  title?: string | null;
  initialPrompt?: string | null;
  planSteps?: string[];
  recentMessages?: AgentChatMessage[];
  onAskPrompt?: (prompt: string) => void | Promise<void>;
  isAgentConnected?: boolean;
  isProcessing?: boolean;
}

export default function ProjectInfo({
  title,
  initialPrompt,
  planSteps = [],
  recentMessages = [],
  onAskPrompt,
  isAgentConnected = false,
  isProcessing = false,
}: ProjectInfoProps) {
  const [askPrompt, setAskPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recentActivity = useMemo(() => {
    return [...recentMessages].slice(-4).reverse();
  }, [recentMessages]);

  const handleAskSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = askPrompt.trim();
    if (!trimmed || !onAskPrompt) return;
    try {
      setIsSubmitting(true);
      await Promise.resolve(onAskPrompt(trimmed));
      setAskPrompt("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const askInputDisabled = !isAgentConnected || isSubmitting || isProcessing;

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto">
      {/* Project Title Bubble */}
      <div className="px-4 pt-6 pb-4">
        <div className="bg-neutral-100 rounded-2xl px-5 py-4">
          <h1 className="text-lg font-normal text-neutral-700 leading-relaxed">
            {title || "Untitled Likeable project"}
          </h1>
        </div>
      </div>

      {/* Initial Prompt */}
      <div className="px-4 pb-5">
        <h2 className="text-sm font-bold text-neutral-900 mb-2">
          Initial Prompt
        </h2>
        <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
          {initialPrompt || "No initial prompt saved for this project yet."}
        </p>
      </div>

      {/* Plan */}
      <div className="px-4 pb-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-neutral-900">Active Plan</h2>
          <span className="text-[11px] text-neutral-500">
            {planSteps.length ? `${planSteps.length} steps` : "No steps yet"}
          </span>
        </div>
        {planSteps.length > 0 ? (
          <ol className="space-y-1.5 list-decimal list-inside text-sm text-neutral-600">
            {planSteps.map((step, index) => (
              <li key={`${step}-${index}`} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-neutral-500">
            Ask Likeable to generate a plan to see it here.
          </p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="px-4 pb-6">
        <h2 className="text-sm font-bold text-neutral-900 mb-2">
          Recent Activity
        </h2>
        {recentActivity.length > 0 ? (
          <ul className="space-y-2">
            {recentActivity.map((message) => (
              <li
                key={message.id}
                className="text-sm text-neutral-600 border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-neutral-500 uppercase">
                    {message.from === "USER" ? "You" : "Likeable"}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">
                  {message.contents}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-500">
            No messages yet. Start the conversation to see updates here.
          </p>
        )}
      </div>

      {/* Bottom Input Area */}
      <div className="mt-auto px-4 py-4 border-t border-neutral-200 bg-white">
        {/* Manual Start Button - if initial prompt exists but hasn't been run */}
        {initialPrompt && !isProcessing && recentMessages.length === 0 && (
          <div className="mb-3">
            <button
              onClick={() => {
                console.log("[ProjectInfo] Start Building button clicked");
                if (initialPrompt && onAskPrompt) {
                  console.log("[ProjectInfo] Calling onAskPrompt with:", initialPrompt.slice(0, 50));
                  onAskPrompt(initialPrompt);
                }
              }}
              disabled={!isAgentConnected}
              className="w-full px-3 py-2 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAgentConnected ? "Start Building" : "Connecting..."}
            </button>
          </div>
        )}
        <div className="mb-2 flex gap-2">
          <button className="flex-1 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors">
            Back to Preview
          </button>
          <button className="px-3 py-1.5 text-xs font-medium text-neutral-900 bg-neutral-100 rounded transition-colors">
            Code
          </button>
        </div>
        <form className="relative" onSubmit={handleAskSubmit}>
          <input
            type="text"
            value={askPrompt}
            onChange={(event) => setAskPrompt(event.target.value)}
            placeholder={
              !isAgentConnected
                ? "Connecting to Likeable…"
                : isProcessing
                  ? "Processing request…"
                  : "Ask Likeable..."
            }
            disabled={askInputDisabled}
            className="w-full px-3 py-2 pr-12 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-white disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            aria-label="Send request to Likeable"
            disabled={askInputDisabled || !askPrompt.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold disabled:bg-neutral-300"
          >
            {isSubmitting ? "..." : "L"}
          </button>
        </form>
        <div className="flex gap-2 mt-2">
          <button className="flex-1 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors border border-neutral-200">
            Visual edits
          </button>
          <button className="flex-1 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded transition-colors border border-neutral-200">
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}

