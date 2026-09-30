"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import ProjectInfo from "@/app/components/ProjectInfo";
import FileExplorer from "@/app/components/FileExplorer";
import EditorSection from "@/app/components/EditorSection";
import ChatSection from "@/app/components/ChatSection";
import ProgressLoader from "@/app/components/ProgressLoader";
import { useProject, useProjectFiles, useSandboxInfo } from "@/app/hooks/useProjectQueries";
import { useWebSocket } from "@/app/hooks/useWebSocket";
import { useAgentSession } from "@/app/hooks/useAgentSession";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const { id } = use(params);
  const editorRef = useRef<{ openFile: (filePath: string) => void } | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  // React Query hooks
  const { data: projectData, isLoading: projectLoading, error: projectError } = useProject(id);
  const { data: filesData, isLoading: filesLoading } = useProjectFiles(id);
  const { data: sandboxData } = useSandboxInfo(id);
  const project = projectData?.project;
  const files = filesData?.files ?? [];

  // Debug: Log project data loading
  useEffect(() => {
    console.log("[ProjectPage] Project data state:", {
      isLoading: projectLoading,
      hasData: !!projectData,
      hasProject: !!project,
      projectId: project?.id,
      hasInitialPrompt: !!project?.initialPrompt,
      initialPrompt: project?.initialPrompt?.slice(0, 100),
      error: projectError,
    });
  }, [projectLoading, projectData, project, projectError]);

  const { 
    messages, 
    sendUserMessage, 
    handleAgentEvent, 
    planSteps, 
    isProcessing,
    stageInfo,
    stageLabel,
  } = useAgentSession(id);
  const [hasBootstrappedPrompt, setHasBootstrappedPrompt] = useState(false);

  // WebSocket connection with error handling
  const { isConnected, connectionError, sendMessage } = useWebSocket({
    projectId: id,
    onMessage: handleAgentEvent,
  });

  const handleAgentPrompt = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      console.log("[ProjectPage] 🔵 handleAgentPrompt called:", { 
        promptLength: trimmed.length, 
        isConnected,
        promptPreview: trimmed.slice(0, 50),
        sendMessageAvailable: !!sendMessage,
      });
      
      if (!trimmed) {
        console.error("[ProjectPage] ❌ handleAgentPrompt aborted - empty prompt");
        return;
      }
      
      if (!isConnected) {
        console.error("[ProjectPage] ❌ handleAgentPrompt aborted - WebSocket not connected");
        return;
      }
      
      if (!sendMessage) {
        console.error("[ProjectPage] ❌ handleAgentPrompt aborted - sendMessage not available");
        return;
      }
      
      const message = {
        type: "start_agent",
        prompt: trimmed,
      };
      
      console.log("[ProjectPage] 📤 Sending start_agent message:", message);
      const sent = sendMessage(message);
      console.log("[ProjectPage] ✅ Message send result:", sent);
      
      if (!sent) {
        console.error("[ProjectPage] ❌ Failed to send message! WebSocket state might be wrong.");
      }
    },
    [sendMessage, isConnected]
  );

  const handleUserPrompt = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      console.log("[ProjectPage] handleUserPrompt called:", { 
        promptLength: trimmed.length,
        promptPreview: trimmed.slice(0, 50),
        isConnected,
      });
      
      if (!trimmed) {
        console.log("[ProjectPage] handleUserPrompt aborted - empty prompt");
        return;
      }
      
      if (!isConnected) {
        console.log("[ProjectPage] handleUserPrompt aborted - WebSocket not connected");
        return;
      }
      
      console.log("[ProjectPage] Calling sendUserMessage and handleAgentPrompt...");
      const persistPromise = sendUserMessage(trimmed);
      handleAgentPrompt(trimmed);
      await persistPromise;
      console.log("[ProjectPage] handleUserPrompt completed");
    },
    [sendUserMessage, handleAgentPrompt, isConnected]
  );

  // Note: Sandbox is created by the agent when handling the initial prompt
  // We no longer auto-create sandboxes here to prevent race conditions

  // Set first file as active when files load
  useEffect(() => {
    if (files.length > 0 && !activeFile) {
      const firstFile = findFirstFile(files);
      if (firstFile) {
        setActiveFile(firstFile.path);
        editorRef.current?.openFile(firstFile.path);
      }
    }
  }, [files, activeFile]);

  // Auto-run the initial prompt once when the project loads
  useEffect(() => {
    // Wait for project data to load and WebSocket to connect
    const projectReady = !projectLoading && project?.initialPrompt;
    const messagesEmpty = messages.length === 0;
    const canBootstrap = !hasBootstrappedPrompt && projectReady && isConnected && messagesEmpty;
    
    console.log("[ProjectPage] Auto-bootstrap check:", {
      hasBootstrappedPrompt,
      projectLoading,
      hasInitialPrompt: !!project?.initialPrompt,
      initialPromptPreview: project?.initialPrompt?.slice(0, 50),
      isConnected,
      messagesLength: messages.length,
      messagesEmpty,
      projectReady,
      canBootstrap,
    });
    
    if (canBootstrap) {
      console.log("[ProjectPage] ✅ Auto-bootstrapping initial prompt...");
      setHasBootstrappedPrompt(true);
      // Use a small delay to ensure WebSocket is fully ready
      setTimeout(() => {
        console.log("[ProjectPage] Executing handleUserPrompt with:", project.initialPrompt?.slice(0, 50));
        handleUserPrompt(project.initialPrompt);
      }, 200);
    } else if (projectReady && isConnected && !hasBootstrappedPrompt) {
      console.log("[ProjectPage] ⚠️ Cannot bootstrap - missing requirement:", {
        hasBootstrappedPrompt,
        projectReady,
        isConnected,
        messagesEmpty,
      });
    }
  }, [
    hasBootstrappedPrompt,
    projectLoading,
    project?.initialPrompt,
    isConnected,
    messages.length,
    handleUserPrompt,
  ]);

  const handleFileSelect = (filePath: string) => {
    editorRef.current?.openFile(filePath);
    setActiveFile(filePath);
  };

  // Helper to find first file in tree
  function findFirstFile(nodes: any[]): { path: string } | null {
    for (const node of nodes) {
      if (node.type === "file") {
        return { path: node.path };
      }
      if (node.children && node.children.length > 0) {
        const found = findFirstFile(node.children);
        if (found) return found;
      }
    }
    return null;
  }

  // Build file contents map from files data
  const fileContents: Record<string, string> = {};
  if (files.length > 0) {
    function extractFiles(nodes: any[]) {
      for (const node of nodes) {
        if (node.type === "file") {
          fileContents[node.path] = "";
        }
        if (node.children) {
          extractFiles(node.children);
        }
      }
    }
    extractFiles(files);
  }

  const previewUrl = sandboxData?.previewUrl || null;

  // Connection status display
  const getConnectionStatus = () => {
    if (connectionError) {
      return { text: connectionError, color: "text-red-600", dot: "bg-red-500" };
    }
    if (isConnected) {
      if (isProcessing) {
        return { text: stageLabel || "Processing...", color: "text-amber-600", dot: "bg-amber-500 animate-pulse" };
      }
      return { text: "Connected", color: "text-green-600", dot: "bg-green-500" };
    }
    return { text: "Connecting...", color: "text-neutral-600", dot: "bg-neutral-400 animate-pulse" };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <main className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b border-neutral-200 px-4 flex items-center justify-between bg-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">L</span>
            </div>
            <span className="text-sm font-medium text-neutral-900">
              likeable
            </span>
          </div>
          <span className="text-xs text-neutral-500">•</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connectionStatus.dot}`} />
            <span className={`text-xs ${connectionStatus.color}`}>
              {connectionStatus.text}
            </span>
          </div>
          {previewUrl && (
            <>
              <span className="text-xs text-neutral-500">•</span>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Preview
              </a>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Icons placeholder */}
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-neutral-100 rounded">
              <svg
                className="w-4 h-4 text-neutral-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
            <button className="p-1.5 hover:bg-neutral-100 rounded">
              <svg
                className="w-4 h-4 text-neutral-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </button>
            <button className="p-1.5 hover:bg-neutral-100 rounded">
              <svg
                className="w-4 h-4 text-neutral-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </button>
          </div>
          <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
            Read only
          </span>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ${
              showChat
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
            }`}
          >
            {showChat ? "Hide Chat" : "Show Chat"}
          </button>
          <button className="text-xs text-purple-600 hover:text-purple-700 font-medium">
            Upgrade
          </button>
          <button className="p-1.5 hover:bg-neutral-100 rounded">
            <svg
              className="w-4 h-4 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700">
          {connectionError}
        </div>
      )}

      {/* Progress Loader - Shows when processing */}
      {(isProcessing || stageInfo) && (
        <div className="border-b border-neutral-200 px-4 py-3 bg-neutral-50">
          <ProgressLoader
            stageInfo={stageInfo}
            stageLabel={stageLabel}
            isProcessing={isProcessing}
          />
        </div>
      )}

      {/* Main Content Area - Three Panes */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Project Info */}
        <div className="w-80 flex-shrink-0 border-r border-neutral-200">
          <ProjectInfo
            title={project?.title}
            initialPrompt={project?.initialPrompt}
            planSteps={planSteps}
            recentMessages={messages}
            onAskPrompt={handleUserPrompt}
            isAgentConnected={isConnected}
            isProcessing={isProcessing}
          />
        </div>

        {/* Middle Pane - File Explorer */}
        <div className="w-64 flex-shrink-0 border-r border-neutral-200">
          {filesLoading ? (
            <div className="p-4 text-sm text-neutral-500">Loading files...</div>
          ) : (
            <FileExplorer
              projectId={id}
              files={files}
              activeFile={activeFile || undefined}
              onFileSelect={handleFileSelect}
            />
          )}
        </div>

        {/* Right Pane - Editor and Chat */}
        <div className="flex-1 min-w-0 flex overflow-hidden">
          <div className={`flex-1 min-w-0 transition-all ${showChat ? 'w-2/3' : 'w-full'}`}>
            <EditorSection
              ref={editorRef}
              projectId={id}
              fileContents={fileContents}
              initialFile={activeFile ? { path: activeFile, code: "" } : undefined}
              onActiveFileChange={setActiveFile}
              sandboxPreviewUrl={previewUrl || null}
            />
          </div>
          {showChat && (
            <div className="w-1/3 border-l border-neutral-200 flex-shrink-0">
              <ChatSection 
                messages={messages} 
                onSubmitPrompt={handleUserPrompt} 
                isAgentConnected={isConnected}
                isProcessing={isProcessing}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
