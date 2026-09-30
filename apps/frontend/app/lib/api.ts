const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3010";

interface ApiResponse<T> {
  message: string;
  [key: string]: any;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: "include", // Include cookies for auth
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function register(email: string, password: string, name?: string) {
  return apiRequest<ApiResponse<{}>>(`/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function login(email: string, password: string) {
  return apiRequest<ApiResponse<{}>>(`/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function createProject(title: string, initialPrompt: string) {
  return apiRequest<ApiResponse<{ project: any }>>(`/api/projects`, {
    method: "POST",
    body: JSON.stringify({ title, initialPrompt }),
  });
}

export async function getProjects() {
  return apiRequest<ApiResponse<{ projects: any[] }>>(`/api/projects`);
}

export async function getProject(projectId: string) {
  return apiRequest<ApiResponse<{ project: any }>>(
    `/api/projects/${projectId}`
  );
}

export async function getProjectFiles(projectId: string) {
  return apiRequest<ApiResponse<{ files: any[] }>>(
    `/api/projects/${projectId}/files`
  );
}

export async function getFileContent(projectId: string, filepath: string) {
  const encodedPath = encodeURIComponent(filepath);
  return apiRequest<ApiResponse<{ path: string; content: string }>>(
    `/api/projects/${projectId}/files/${encodedPath}`
  );
}

export async function createSandbox(projectId: string) {
  return apiRequest<ApiResponse<{ sandboxId: string; previewUrl: string }>>(
    `/api/projects/${projectId}/sandbox`,
    { method: "POST" }
  );
}

export async function getSandboxInfo(projectId: string) {
  return apiRequest<
    ApiResponse<{ sandboxId: string | null; previewUrl: string | null }>
  >(`/api/projects/${projectId}/sandbox`);
}

export async function closeSandbox(projectId: string) {
  return apiRequest<ApiResponse<{}>>(`/api/projects/${projectId}/sandbox`, {
    method: "DELETE",
  });
}

export async function createConversationMessage(
  projectId: string,
  contents: string,
  type: string = "TEXT_MESSAGE",
  from: string = "USER",
  toolCall?: any
) {
  return apiRequest<ApiResponse<{ conversation: any }>>(
    `/api/projects/${projectId}/conversations`,
    {
      method: "POST",
      body: JSON.stringify({ contents, type, from, toolCall }),
    }
  );
}
