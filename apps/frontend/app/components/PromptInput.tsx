"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/lib/api";

export default function PromptInput() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Create project with the prompt as both title and initialPrompt
      const title = prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt;
      const response = await createProject(title, prompt);
      
      if (response.project?.id) {
        // Redirect to the project page
        router.push(`/projects/${response.project.id}`);
      } else {
        setError("Failed to create project. Please try again.");
      }
    } catch (err: any) {
      console.error("Error creating project:", err);
      setError(err.message || "Failed to create project. Please make sure you're signed in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl relative">
      <div className="w-full min-h-[112px] sm:h-28 p-3 sm:p-4 bg-white rounded-2xl shadow-[0px_6px_24px_0px_rgba(0,0,0,0.08),0px_2.5px_4px_-1px_rgba(0,0,0,0.08),0px_1.5px_1px_-1px_rgba(0,0,0,0.16),0px_1.5px_4px_-1px_rgba(0,0,0,0.12)] border border-neutral-200 flex items-start">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Build a beautiful todo application"
          className="flex-1 bg-transparent text-neutral-500 text-sm sm:text-base font-normal placeholder:text-neutral-500 outline-none border-none focus:outline-none"
          aria-label="Enter your prompt"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="mt-2 text-sm text-red-600 text-center">{error}</div>
      )}

      <div className="absolute bottom-2 sm:bottom-2.5 left-3 sm:left-3.5 right-3 sm:right-3.5 flex justify-between items-center">
        <button
          type="button"
          className="px-1.5 sm:px-2 py-1 bg-white rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors flex items-center gap-1"
          aria-label="Upload file"
          disabled={isLoading}
        >
          <span className="text-neutral-800 text-[10px] sm:text-xs font-normal cursor-pointer">
            Upload
          </span>
        </button>

        <button
          type="submit"
          disabled={!prompt.trim() || isLoading}
          className="p-1 sm:p-1.5 bg-white rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <span className="text-neutral-800 text-[10px] sm:text-xs font-normal cursor-pointer">
            {isLoading ? "Creating..." : "Send"}
          </span>
        </button>
      </div>
    </form>
  );
}

