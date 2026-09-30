"use client";

import { useState, useRef, useEffect } from "react";
import type { AgentChatMessage } from "@/app/hooks/useAgentSession";

interface ChatSectionProps {
  messages?: AgentChatMessage[];
  onSubmitPrompt?: (prompt: string) => Promise<void> | void;
  isAgentConnected?: boolean;
  isProcessing?: boolean;
}

export default function ChatSection({
  messages = [],
  onSubmitPrompt,
  isAgentConnected = false,
  isProcessing = false,
}: ChatSectionProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendDisabled = !inputMessage.trim() || isSending || !isAgentConnected || isProcessing;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !isAgentConnected) return;

    const messageText = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    try {
      await onSubmitPrompt?.(messageText);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendDisabled) {
        handleSend();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-neutral-200">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-neutral-200 bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Chat</h2>
          <span className={`text-xs ${isProcessing ? "text-amber-600" : "text-neutral-500"}`}>
            {!isAgentConnected ? "Connecting..." : isProcessing ? "Processing..." : "Connected"}
          </span>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-neutral-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
            Start a conversation about your project
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.from === "USER" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.from === "USER"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-900"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.contents}</p>
                {message.type === "TOOL_CALL" && (
                  <span className="text-xs opacity-70 mt-1 block">
                    {message.type}
                  </span>
                )}
                {message.type === "ERROR_MESSAGE" && (
                  <span className="text-xs text-red-400 mt-1 block">
                    Error
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-neutral-200 p-4 bg-white">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 min-h-[60px] max-h-[120px] px-3 py-2 border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-neutral-400 text-sm bg-white"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={sendDisabled}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex-shrink-0"
          >
            {isSending ? "Sending..." : !isAgentConnected ? "Connecting..." : isProcessing ? "Working..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

