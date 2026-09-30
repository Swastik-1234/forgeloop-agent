"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProject,
  getProjectFiles,
  getFileContent,
  createSandbox,
  getSandboxInfo,
} from "../lib/api";

// Project query
export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });
}

// Project files query
export function useProjectFiles(projectId: string) {
  return useQuery({
    queryKey: ["projectFiles", projectId],
    queryFn: () => getProjectFiles(projectId),
    enabled: !!projectId,
  });
}

// File content query
export function useFileContent(projectId: string, filepath: string | null) {
  return useQuery({
    queryKey: ["fileContent", projectId, filepath],
    queryFn: () => {
      if (!filepath) throw new Error("Filepath is required");
      return getFileContent(projectId, filepath);
    },
    enabled: !!projectId && !!filepath,
  });
}

// Sandbox info query
export function useSandboxInfo(projectId: string) {
  return useQuery({
    queryKey: ["sandboxInfo", projectId],
    queryFn: () => getSandboxInfo(projectId),
    enabled: !!projectId,
  });
}

// Create sandbox mutation
export function useCreateSandbox(projectId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => createSandbox(projectId),
    onSuccess: () => {
      // Invalidate sandbox info to refetch
      queryClient.invalidateQueries({ queryKey: ["sandboxInfo", projectId] });
    },
  });
}

