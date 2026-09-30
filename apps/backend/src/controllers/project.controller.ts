import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { createSandbox, previewUrlFor } from "../services/sandbox.service.js";
import { closeSandbox } from "../tools/tool.js";

interface FileTreeNode {
  name: string;
  type: "file" | "folder";
  path?: string;
  children?: FileTreeNode[];
}

function buildFileTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const fullPath of paths) {
    const parts = fullPath.split("/").filter(Boolean);
    let level = root;
    let accPath = "";

    parts.forEach((part, idx) => {
      accPath = accPath ? `${accPath}/${part}` : part;
      const isFile = idx === parts.length - 1;
      let node = level.find((n) => n.name === part && n.type === (isFile ? "file" : "folder"));

      if (!node) {
        node = isFile
          ? { name: part, type: "file", path: accPath }
          : { name: part, type: "folder", children: [] };
        level.push(node);
      }

      if (!isFile) {
        level = node.children!;
      }
    });
  }

  return root;
}

export const createProject = async (req: Request, res: Response) => {
  try {
    const { title, initialPrompt } = req.body;
    const userId = req.user?.id;

    if (!title || !initialPrompt) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await prisma.project.create({
      data: { title, initialPrompt, userId },
    });
    return res.status(201).json({
      message: "Project created successfully",
      project,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const projects = await prisma.project.findMany({ where: { userId } });
    return res.status(200).json({
      message: "Projects fetched successfully",
      projects,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({ error: "Project ID is required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const project = await prisma.project.findUnique({
      where: { id: id, userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    return res.status(200).json({
      message: "Project fetched successfully",
      project,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createProjectConversationChatMessage = async (
  req: Request,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    const { contents, type, toolCall, from } = req.body;
    const userId = req.user?.id;

    if (!projectId || !contents || !type || !from) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId, userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const conversation = await prisma.conversation.create({
      data: { projectId: projectId, contents, type, toolCall, from },
    });

    return res.status(200).json({
      message: "Project conversation chat message created successfully",
      conversation,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getProjectFiles = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!id) return res.status(400).json({ error: "Project ID is required" });
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { id, userId } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const files = await prisma.projectFile.findMany({
      where: { projectId: id },
      select: { path: true },
      orderBy: { path: "asc" },
    });

    const tree = buildFileTree(files.map((f) => f.path));
    return res.status(200).json({ message: "Files fetched successfully", files: tree });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getFileContent = async (req: Request, res: Response) => {
  try {
    const { id, filepath } = req.params;
    const userId = req.user?.id;
    if (!id) return res.status(400).json({ error: "Project ID is required" });
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!filepath) return res.status(400).json({ error: "Filepath is required" });

    const project = await prisma.project.findUnique({ where: { id, userId } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const decodedPath = decodeURIComponent(filepath);
    const file = await prisma.projectFile.findUnique({
      where: { projectId_path: { projectId: id, path: decodedPath } },
    });
    if (!file) return res.status(404).json({ error: "File not found" });

    return res.status(200).json({
      message: "File fetched successfully",
      path: file.path,
      content: file.content,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createProjectSandbox = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!id) return res.status(400).json({ error: "Project ID is required" });
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { id, userId } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const sandbox = await createSandbox(id);
    const previewUrl = previewUrlFor(sandbox.sandboxId);

    return res.status(200).json({
      message: "Sandbox ready",
      sandboxId: sandbox.sandboxId,
      previewUrl,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getProjectSandbox = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!id) return res.status(400).json({ error: "Project ID is required" });
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { id, userId } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    return res.status(200).json({
      message: "Sandbox info fetched successfully",
      sandboxId: project.sandboxId,
      previewUrl: project.sandboxUrl,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteProjectSandbox = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!id) return res.status(400).json({ error: "Project ID is required" });
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { id, userId } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    if (!project.sandboxId) {
      return res.status(200).json({ message: "No sandbox to close" });
    }

    await closeSandbox(id);
    await prisma.project.update({
      where: { id },
      data: { sandboxId: null, sandboxUrl: null },
    });

    return res.status(200).json({ message: "Sandbox closed successfully" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal server error" });
  }
};
