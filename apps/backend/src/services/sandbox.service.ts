import { Sandbox } from "@e2b/code-interpreter";
import { prisma } from "../lib/prisma.js";
import type { Emit } from "../tools/tool.js";

const SANDBOX_TEMPLATE = process.env.E2B_TEMPLATE_ALIAS || "likeable-react-base";

export function previewUrlFor(sandboxId: string): string {
  return `https://5173-${sandboxId}.e2b.app`;
}

export async function createSandbox(projectId: string, emit?: Emit): Promise<Sandbox> {
  let sandbox: Sandbox | null = null;

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.sandboxId) {
    try {
      sandbox = await Sandbox.connect(project.sandboxId);
    } catch (error) {
      console.error("Error connecting to old sandbox:", error);
    }
  }
  if (!sandbox) {
    sandbox = await Sandbox.create(SANDBOX_TEMPLATE);
    const previewUrl = previewUrlFor(sandbox.sandboxId);
    await prisma.project.update({
      where: { id: projectId },
      data: { sandboxId: sandbox.sandboxId, sandboxUrl: previewUrl },
    });
    emit?.({ e: "sandbox_created", sandboxId: sandbox.sandboxId, previewUrl });
  }

  return sandbox;
}
