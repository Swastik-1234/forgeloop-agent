import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { prisma } from "../lib/prisma.js";
import { Exa } from "exa-js";
import { createSandbox } from "../services/sandbox.service.js";

const APP_ROOT = "/home/user/react-app";

const exaClient = process.env.EXASEARCH_API_KEY
  ? new Exa(process.env.EXASEARCH_API_KEY)
  : null;

export type AgentEvent = { e: string; [key: string]: any };
export type Emit = (event: AgentEvent) => void;

// Internal LangChain tool names -> the kebab-case names the frontend's
// TOOL_NAME_MAP (apps/frontend/app/hooks/useAgentSession.ts) expects on
// tool_started/tool_completed events. Without this mapping every tool
// event is silently dropped by the UI (shouldDisplayToolEvent returns
// false for any name it doesn't recognize).
const TOOL_EVENT_NAME: Record<string, string> = {
  write_file: "write",
  write_multiple_files: "write-multiple-files",
  read_file: "read",
  delete_file: "delete-file",
  rename_file: "rename-file",
  list_directories: "list-directories",
  execute_command: "execute-command",
  add_dependency: "add-dependency",
  test_build: "test-build",
};

const noopEmit: Emit = () => {};

export async function getSandbox(projectId: string, emit?: Emit): Promise<Sandbox> {
  return await createSandbox(projectId, emit);
}

export async function getTools({
  projectId,
  emit,
}: {
  projectId: string;
  emit?: Emit;
}): Promise<StructuredToolInterface[]> {
  const doEmit = emit || noopEmit;
  const sandbox = await getSandbox(projectId, doEmit);

  const tools: StructuredToolInterface[] = [
    createAddDependencyTool(sandbox, doEmit),
    createWriteFileTool(sandbox, projectId, doEmit),
    createReadFileTool(sandbox, doEmit),
    createDeleteFileTool(sandbox, projectId, doEmit),
    createExecuteCommandTool(sandbox, doEmit),
    createRenameFileTool(sandbox, projectId, doEmit),
    createListDirectoriesTool(sandbox, doEmit),
    createTestBuildTool(sandbox, doEmit),
    createWriteMultipleFilesTool(sandbox, projectId, doEmit),
    createStartDevServerTool(sandbox, doEmit),
    createSearchTool(doEmit),
  ];

  return tools;
}

function createAddDependencyTool(sandbox: Sandbox, emit: Emit) {
  return tool(
    async ({ pkg }) => {
      const toolName = TOOL_EVENT_NAME.add_dependency;
      emit({ e: "tool_started", tool: toolName, input: { pkg } });
      emit({ e: "dependency_installation_started", message: `Installing ${pkg}...` });
      try {
        await sandbox.commands.run(`npm install ${pkg}`);
        emit({ e: "dependency_installation_completed", message: `✓ Installed ${pkg}` });
        emit({ e: "tool_completed", tool: toolName, output: `Installed ${pkg}` });
        return `Successfully installed ${pkg}`;
      } catch (e) {
        emit({ e: "dependency_error", message: `Failed to install ${pkg}: ${e}` });
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Failed to install dependency ${pkg}: ${e}`;
      }
    },
    {
      name: "add_dependency",
      description: "Install an npm package dependency",
      schema: z.object({
        pkg: z
          .string()
          .describe("The npm package to install, e.g. react-icons"),
      }),
    }
  );
}

function createWriteFileTool(sandbox: Sandbox, projectId: string, emit: Emit) {
  return tool(
    async ({ filepath, content }) => {
      const toolName = TOOL_EVENT_NAME.write_file;
      const fullPath = `${APP_ROOT}/${filepath.replace(/^\/+/, "")}`;
      emit({ e: "tool_started", tool: toolName, input: { filepath } });

      try {
        await sandbox.files.write(fullPath, content);

        await prisma.projectFile.upsert({
          where: { projectId_path: { projectId, path: filepath } },
          create: {
            projectId,
            path: filepath,
            content,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          update: {
            content,
            updatedAt: new Date(),
          },
        });

        emit({ e: "file_created", filepath });
        emit({ e: "tool_completed", tool: toolName, output: `Wrote ${filepath}` });
        return `File ${filepath} created successfully.`;
      } catch (e) {
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Failed to create file ${filepath}: ${e}`;
      }
    },
    {
      name: "write_file",
      description: "Create or overwrite a file with the given content",
      schema: z.object({
        filepath: z.string().describe("The file path, e.g. src/App.tsx"),
        content: z.string().describe("The content to write to the file"),
      }),
    }
  );
}

function createReadFileTool(sandbox: Sandbox, emit: Emit) {
  return tool(
    async ({ filepath }) => {
      const toolName = TOOL_EVENT_NAME.read_file;
      const fullPath = `${APP_ROOT}/${filepath.replace(/^\/+/, "")}`;
      emit({ e: "tool_started", tool: toolName, input: { filepath } });

      try {
        const content = await sandbox.files.read(fullPath);
        emit({ e: "tool_completed", tool: toolName, output: `Read ${filepath}` });
        return `Content of ${filepath}:\n${content}`;
      } catch (e) {
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Failed to read file ${filepath}: ${e}`;
      }
    },
    {
      name: "read_file",
      description: "Read a file and return its contents",
      schema: z.object({
        filepath: z.string().describe("Path like src/App.tsx or package.json"),
      }),
    }
  );
}

function createDeleteFileTool(sandbox: Sandbox, projectId: string, emit: Emit) {
  return tool(
    async ({ filepath }) => {
      const toolName = TOOL_EVENT_NAME.delete_file;
      const fullPath = `${APP_ROOT}/${filepath.replace(/^\/+/, "")}`;
      emit({ e: "tool_started", tool: toolName, input: { filepath } });

      try {
        await sandbox.files.remove(fullPath);
        await prisma.projectFile.delete({
          where: { projectId_path: { projectId, path: filepath } },
        });

        emit({ e: "file_deleted", filepath });
        emit({ e: "tool_completed", tool: toolName, output: `Deleted ${filepath}` });
        return `File ${filepath} deleted successfully.`;
      } catch (e) {
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Failed to delete file ${filepath}: ${e}`;
      }
    },
    {
      name: "delete_file",
      description: "Delete a file",
      schema: z.object({
        filepath: z.string().describe("Path like src/old-component.tsx"),
      }),
    }
  );
}

function createExecuteCommandTool(sandbox: Sandbox, emit: Emit) {
  return tool(
    async ({ command }) => {
      const toolName = TOOL_EVENT_NAME.execute_command;
      emit({ e: "tool_started", tool: toolName, input: { command } });

      const blockedPatterns = [
        /npx\s+create-react-app/,
        /npm\s+create\s+vite/,
        /npm\s+create\s+.*app/,
        /create-react-app/,
        /create-vite/,
      ];

      const isBlocked = blockedPatterns.some((pattern) =>
        pattern.test(command)
      );
      if (isBlocked) {
        const msg = `ERROR: App creation commands are not allowed. The React app already exists at ${APP_ROOT}. Instead, use the 'write' or 'write-multiple-files' tools to create/modify files directly. For example, use 'write' to create src/components/YourComponent.tsx instead of creating a new app.`;
        emit({ e: "tool_error", tool: toolName, error: msg });
        return msg;
      }

      try {
        await sandbox.commands.run(`cd ${APP_ROOT} && ${command}`);
        emit({ e: "tool_completed", tool: toolName, output: "Command executed successfully." });
        return `Command executed successfully.`;
      } catch (e) {
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Command failed: ${e}`;
      }
    },
    {
      name: "execute_command",
      description:
        "Execute a shell command in /home/user/react-app (e.g., npm install, npm run build). NOTE: Do NOT use this to create new React apps - the app already exists. Use 'write' tools instead.",
      schema: z.object({
        command: z.string().describe("The shell command to run"),
      }),
    }
  );
}

function createRenameFileTool(sandbox: Sandbox, projectId: string, emit: Emit) {
  return tool(
    async ({ oldPath, newPath }) => {
      const toolName = TOOL_EVENT_NAME.rename_file;
      const oldFullPath = `${APP_ROOT}/${oldPath.replace(/^\/+/, "")}`;
      const newFullPath = `${APP_ROOT}/${newPath.replace(/^\/+/, "")}`;
      emit({ e: "tool_started", tool: toolName, input: { oldPath, newPath } });

      try {
        await sandbox.files.rename(oldFullPath, newFullPath);
        await prisma.projectFile.update({
          where: { projectId_path: { projectId, path: oldPath } },
          data: { path: newPath, updatedAt: new Date() },
        });

        emit({ e: "file_renamed", oldPath, newPath });
        emit({ e: "tool_completed", tool: toolName, output: `Renamed ${oldPath} -> ${newPath}` });
        return `File renamed from ${oldPath} to ${newPath}`;
      } catch (e) {
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Failed to rename file: ${e}`;
      }
    },
    {
      name: "rename_file",
      description: "Rename or move a file",
      schema: z.object({
        oldPath: z.string().describe("The current path of the file"),
        newPath: z.string().describe("The new path of the file"),
      }),
    }
  );
}

function createListDirectoriesTool(sandbox: Sandbox, emit: Emit) {
  return tool(
    async ({ path }) => {
      const toolName = TOOL_EVENT_NAME.list_directories;
      emit({ e: "tool_started", tool: toolName, input: { path } });
      try {
        // `tree` isn't installed in the E2B base image; `find` is
        // universally available and gives an equivalent listing.
        const cmd = `find ${path} -not -path '*/node_modules/*' -not -path '*/.*' | sort`;
        const result = await sandbox.commands.run(cmd);
        emit({ e: "tool_completed", tool: toolName, output: "Listed directory" });
        return `Directory structure:\n${result.stdout}`;
      } catch (e) {
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Failed to list directory ${path}: ${e}`;
      }
    },
    {
      name: "list_directories",
      description:
        "List directory structure (excludes node_modules and hidden files)",
      schema: z.object({
        path: z
          .string()
          .default(".")
          .describe('Relative path like "." or "src"'),
      }),
    }
  );
}

function createTestBuildTool(sandbox: Sandbox, emit: Emit) {
  return tool(
    async () => {
      const toolName = TOOL_EVENT_NAME.test_build;
      emit({ e: "tool_started", tool: toolName });
      emit({ e: "build_started" });
      try {
        await sandbox.commands.run(
          `cd ${APP_ROOT} && rm -rf node_modules/.vite-temp && npm install`
        );
        await sandbox.commands.run(`cd ${APP_ROOT} && npm run build`);
        emit({ e: "build_test_success" });
        emit({ e: "tool_completed", tool: toolName, output: "Build passed" });
        return `Build PASSED successfully.`;
      } catch (e) {
        emit({ e: "build_test_failed", message: String(e) });
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Build FAILED: ${e}`;
      }
    },
    {
      name: "test_build",
      description:
        "Run npm install and npm run build to validate the app compiles",
      schema: z.object({}),
    }
  );
}

function createWriteMultipleFilesTool(sandbox: Sandbox, projectId: string, emit: Emit) {
  return tool(
    async ({ files }) => {
      const toolName = TOOL_EVENT_NAME.write_multiple_files;
      emit({ e: "tool_started", tool: toolName, input: { count: files.length } });
      try {
        const fileObjects = files.map((f) => ({
          path: `${APP_ROOT}/${f.path.replace(/^\/+/, "")}`,
          content: f.content,
        }));

        for (const file of fileObjects) {
          await sandbox.files.write(file.path, file.content);
        }

        await prisma.projectFile.createMany({
          data: files.map((f) => ({
            projectId,
            path: f.path,
            content: f.content,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          skipDuplicates: true,
        });

        const paths = files.map((f) => f.path);
        emit({ e: "files_created", files: paths, count: paths.length });
        emit({ e: "tool_completed", tool: toolName, output: `Created ${paths.length} files` });
        return `Successfully created ${paths.length} files: ${paths.join(", ")}`;
      } catch (e) {
        emit({ e: "tool_error", tool: toolName, error: String(e) });
        return `Failed to create files: ${e}`;
      }
    },
    {
      name: "write_multiple_files",
      description: "Create multiple files at once for efficiency",
      schema: z.object({
        files: z
          .array(
            z.object({
              path: z.string().describe("Relative path (e.g., src/App.tsx)"),
              content: z.string().describe("File contents"),
            })
          )
          .min(1),
      }),
    }
  );
}

function createStartDevServerTool(sandbox: Sandbox, emit: Emit) {
  return tool(
    async () => {
      try {
        // Check if server is already running
        const checkOutput = await sandbox.commands.run(
          `lsof -ti:5173 2>/dev/null || echo "not_running"`
        );
        if (!checkOutput.stdout.includes("not_running")) {
          const previewUrl = `https://5173-${sandbox.sandboxId}.e2b.app`;
          emit({ e: "sandbox_created", sandboxId: sandbox.sandboxId, previewUrl });
          return `Dev server is already running on port 5173. Preview URL: ${previewUrl}`;
        }

        const checkPackageJson = await sandbox.commands.run(
          `cd ${APP_ROOT} && test -f package.json && echo "exists" || echo "missing"`
        );
        if (checkPackageJson.stdout.includes("missing")) {
          return `Error: package.json not found in ${APP_ROOT}. Make sure you're working in the correct directory.`;
        }

        await sandbox.commands.run(
          `cd ${APP_ROOT} && nohup npm run dev > /tmp/vite.log 2>&1 &`
        );

        let attempts = 0;
        let serverRunning = false;
        while (attempts < 10 && !serverRunning) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const verifyOutput = await sandbox.commands.run(
            `lsof -ti:5173 2>/dev/null || echo "not_running"`
          );
          if (!verifyOutput.stdout.includes("not_running")) {
            serverRunning = true;
            break;
          }
          attempts++;
        }

        if (serverRunning) {
          const previewUrl = `https://5173-${sandbox.sandboxId}.e2b.app`;
          emit({ e: "sandbox_created", sandboxId: sandbox.sandboxId, previewUrl });
          return `Dev server started successfully on port 5173.\n\nPreview URL: ${previewUrl}\n\nThe dev server is running in the background. You can access your app at the preview URL above.`;
        } else {
          const logs = await sandbox.commands.run(
            `tail -20 /tmp/vite.log 2>/dev/null || echo "No logs available"`
          );
          return `Dev server may not have started properly. Check the logs:\n${logs.stdout}\n\nYou can try running 'cd ${APP_ROOT} && npm run dev' manually in the sandbox.`;
        }
      } catch (e) {
        return `Failed to start dev server: ${e}. You can try running 'cd ${APP_ROOT} && npm run dev' manually in the sandbox.`;
      }
    },
    {
      name: "start_dev_server",
      description:
        "Start the Vite dev server on port 5173 in the background. This makes the app accessible via the preview URL. The React app should already be set up in /home/user/react-app - do not create a new app.",
      schema: z.object({}),
    }
  );
}

function createSearchTool(emit: Emit) {
  return tool(
    async ({ query, type }) => {
      if (!exaClient) {
        return "Search is not configured (EXASEARCH_API_KEY is missing) — skip web search and proceed with what you already know.";
      }

      try {
        const options: any = {
          useAutoPrompts: true,
          numResults: 3,
          type: "neural",
        };

        if (type === "general") {
          options.contents = {
            text: true,
          };
        }

        const response = await exaClient.search(query, options);
        const formattedResults = response.results.map((result: any) => {
          if (type === "image") {
            return {
              title: result.title,
              image: result.image,
              url: result.url,
            };
          } else {
            return {
              title: result.title,
              url: result.url,
              text: result.summary,
            };
          }
        });

        return `Found ${formattedResults.length} results:\n${formattedResults
          .map((result) => `${result?.title}\n${result?.url}\n${result?.image ?? ""}`)
          .join("\n")}`;
      } catch (e) {
        return `Search failed: ${e}`;
      }
    },
    {
      name: "search",
      description: "Search the web for information",
      schema: z.object({
        query: z.string().describe("The query to search for"),
        type: z.enum(["general", "image"]).default("general"),
      }),
    }
  );
}

export async function closeSandbox(projectId: string) {
  const sandbox = await createSandbox(projectId);
  await sandbox.kill();
}
