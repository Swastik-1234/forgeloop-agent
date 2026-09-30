"use client";

import { useMemo, useState } from "react";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
  path?: string;
}

interface FileExplorerProps {
  projectId: string;
  files?: FileNode[];
  activeFile?: string;
  onFileSelect?: (filePath: string) => void;
}

const defaultFiles: FileNode[] = [
  {
    name: "public",
    type: "folder",
    children: [
      { name: "favicon.ico", type: "file", path: "public/favicon.ico" },
      { name: "placeholder.svg", type: "file", path: "public/placeholder.svg" },
      { name: "robots.txt", type: "file", path: "public/robots.txt" },
    ],
  },
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "components",
        type: "folder",
        children: [
          { name: "TodoApp.tsx", type: "file", path: "src/components/TodoApp.tsx" },
        ],
      },
      {
        name: "hooks",
        type: "folder",
        children: [],
      },
      {
        name: "lib",
        type: "folder",
        children: [],
      },
      {
        name: "pages",
        type: "folder",
        children: [
          { name: "App.css", type: "file", path: "src/pages/App.css" },
          { name: "App.tsx", type: "file", path: "src/pages/App.tsx" },
          { name: "index.css", type: "file", path: "src/pages/index.css" },
          { name: "main.tsx", type: "file", path: "src/pages/main.tsx" },
          {
            name: "vite-env.d.ts",
            type: "file",
            path: "src/pages/vite-env.d.ts",
          },
        ],
      },
    ],
  },
  { name: ".gitignore", type: "file", path: ".gitignore" },
  { name: "components.json", type: "file", path: "components.json" },
  { name: "eslint.config.js", type: "file", path: "eslint.config.js" },
  { name: "index.html", type: "file", path: "index.html" },
];

export default function FileExplorer({
  projectId,
  files = defaultFiles,
  activeFile,
  onFileSelect,
}: FileExplorerProps) {
  const [activeTab, setActiveTab] = useState<"files" | "search">("files");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(["src", "src/pages", "src/components"])
  );
  const [searchQuery, setSearchQuery] = useState("");

  const flattenedFiles = useMemo(() => {
    const collected: { name: string; path: string }[] = [];
    const traverse = (nodes: FileNode[], parentPath = "") => {
      nodes.forEach((node) => {
        const fullPath = node.path || (parentPath ? `${parentPath}/${node.name}` : node.name);
        if (node.type === "file") {
          collected.push({ name: node.name, path: fullPath });
        } else if (node.children) {
          traverse(node.children, fullPath);
        }
      });
    };
    traverse(files);
    return collected;
  }, [files]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return flattenedFiles;
    const query = searchQuery.toLowerCase();
    return flattenedFiles.filter(
      (file) =>
        file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)
    );
  }, [flattenedFiles, searchQuery]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileNode = (node: FileNode, path: string = ""): React.ReactNode => {
    const fullPath = path ? `${path}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(fullPath);
    const isFolder = node.type === "folder";

    const filePath = node.path || fullPath;
    const isActive = !isFolder && activeFile === filePath;

    return (
      <div key={fullPath} className="select-none">
        <div
          className={`flex items-center px-2 py-1 hover:bg-neutral-100 cursor-pointer text-sm ${
            !isFolder ? "pl-6" : ""
          } ${isActive ? "bg-blue-50 text-blue-700 font-medium" : ""}`}
          onClick={() => {
            if (isFolder) {
              toggleFolder(fullPath);
            } else {
              onFileSelect?.(filePath);
            }
          }}
        >
          {isFolder && (
            <span className="mr-1 text-neutral-500 w-3">
              {isExpanded ? "▼" : "▶"}
            </span>
          )}
          <span className="text-neutral-700">{node.name}</span>
        </div>
        {isFolder && isExpanded && node.children && (
          <div className="ml-2">
            {node.children.map((child) => renderFileNode(child, fullPath))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-neutral-200">
      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === "files"
              ? "text-neutral-900 border-b-2 border-neutral-900 bg-white"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === "search"
              ? "text-neutral-900 border-b-2 border-neutral-900 bg-white"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
          }`}
        >
          Search
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "files" ? (
          <div className="py-2">
            <div className="px-2 mb-2">
              <input
                type="text"
                placeholder="Search files"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
              />
            </div>
            {files.map((node) => renderFileNode(node))}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <input
              type="text"
              placeholder="Type to search all files"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-neutral-300 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400 bg-white"
            />
            <div className="max-h-[calc(100%-48px)] overflow-y-auto">
              {filteredFiles.length > 0 ? (
                <ul className="space-y-1">
                  {filteredFiles.map((file) => (
                    <li key={file.path}>
                      <button
                        onClick={() => {
                          onFileSelect?.(file.path);
                          setActiveTab("files");
                        }}
                        className="w-full text-left px-2 py-1 text-xs rounded hover:bg-neutral-100 text-neutral-700"
                      >
                        <span className="block font-medium">{file.name}</span>
                        <span className="text-[11px] text-neutral-500">{file.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-neutral-500 px-1 py-2">
                  No files match “{searchQuery}”.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

