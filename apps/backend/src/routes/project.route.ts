import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import {
  createProject,
  getProjects,
  getProjectById,
  createProjectConversationChatMessage,
  getProjectFiles,
  getFileContent,
  createProjectSandbox,
  getProjectSandbox,
  deleteProjectSandbox,
} from "../controllers/project.controller.js";

const router: Router = Router();

router.use(authenticate);

router.post("/", createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.post("/:projectId/conversations", createProjectConversationChatMessage);

router.get("/:id/files", getProjectFiles);
router.get("/:id/files/:filepath", getFileContent);

router.post("/:id/sandbox", createProjectSandbox);
router.get("/:id/sandbox", getProjectSandbox);
router.delete("/:id/sandbox", deleteProjectSandbox);

export default router;
