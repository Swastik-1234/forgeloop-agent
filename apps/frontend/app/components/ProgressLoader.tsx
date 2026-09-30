"use client";

import type { StageInfo } from "@/app/hooks/useAgentSession";

interface ProgressLoaderProps {
  stageInfo: StageInfo | null;
  stageLabel: string | null;
  isProcessing: boolean;
}

const STAGE_ICONS: Record<string, string> = {
  initializing: "⚙️",
  ingest: "📥",
  planning: "🧠",
  executing: "⚡",
  verifying: "✅",
  finalizing: "📝",
  complete: "🎉",
  error: "❌",
};

export default function ProgressLoader({
  stageInfo,
  stageLabel,
  isProcessing,
}: ProgressLoaderProps) {
  if (!isProcessing && !stageInfo) {
    return null;
  }

  const progress = stageInfo?.progress ?? 0;
  const stage = stageInfo?.stage ?? "initializing";
  const message = stageInfo?.message ?? "Starting...";
  const icon = STAGE_ICONS[stage] || "🔄";
  const isComplete = stage === "complete";
  const isError = stage === "error";

  return (
    <div className={`rounded-lg border p-4 ${
      isError 
        ? "bg-red-50 border-red-200" 
        : isComplete 
          ? "bg-green-50 border-green-200"
          : "bg-blue-50 border-blue-200"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className={`font-medium text-sm ${
            isError ? "text-red-700" : isComplete ? "text-green-700" : "text-blue-700"
          }`}>
            {stageLabel || "Processing"}
          </span>
        </div>
        <span className={`text-xs font-mono ${
          isError ? "text-red-600" : isComplete ? "text-green-600" : "text-blue-600"
        }`}>
          {progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-neutral-200 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-500 ease-out ${
            isError 
              ? "bg-red-500" 
              : isComplete 
                ? "bg-green-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status Message */}
      <p className={`text-xs ${
        isError ? "text-red-600" : isComplete ? "text-green-600" : "text-neutral-600"
      }`}>
        {message}
      </p>

      {/* Step Counter */}
      {stageInfo?.currentStep !== undefined && stageInfo?.totalSteps !== undefined && (
        <p className="text-xs text-neutral-500 mt-1">
          Step {stageInfo.currentStep} of {stageInfo.totalSteps}
        </p>
      )}

      {/* Loading Animation */}
      {isProcessing && !isComplete && !isError && (
        <div className="flex items-center gap-1 mt-2">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      )}
    </div>
  );
}

