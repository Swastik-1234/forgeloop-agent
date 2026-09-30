"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3010";
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL_MS = 30000; // 30 seconds

interface WebSocketEvent {
  e: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  projectId: string;
  onMessage?: (event: WebSocketEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Get the authentication token from cookies (client-side)
 * Note: This only works for non-httpOnly cookies.
 * For httpOnly cookies, the browser will automatically include them.
 */
function getTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "token") {
      return value;
    }
  }
  return null;
}

export function useWebSocket({
  projectId,
  onMessage,
  onConnectionChange,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const queryClient = useQueryClient();

  // Track connection state changes
  useEffect(() => {
    onConnectionChange?.(isConnected);
  }, [isConnected, onConnectionChange]);

  const startPingInterval = useCallback(() => {
    // Clear any existing interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }

    // Start new ping interval to keep connection alive
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
  }, []);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (
      isConnectingRef.current ||
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    // Clean up any existing connection first
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {
        // Ignore errors when closing
      }
      wsRef.current = null;
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (!projectId) {
      setConnectionError("Project ID is required");
      return;
    }

    isConnectingRef.current = true;
    setConnectionError(null);

    try {
      // Build WebSocket URL with projectId
      // Note: Auth token will be sent via cookies automatically for same-origin
      // For cross-origin, we include the token as a query param
      const url = new URL(WS_BASE_URL);
      url.searchParams.set("projectId", projectId);
      
      // Try to get token for cross-origin scenarios
      const token = getTokenFromCookie();
      if (token) {
        url.searchParams.set("token", token);
      }

      const ws = new WebSocket(url.toString());

      ws.onopen = () => {
        console.log(`WebSocket connected for project: ${projectId}`);
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        isConnectingRef.current = false;
        startPingInterval();
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketEvent = JSON.parse(event.data);

          // Handle connection confirmation
          if (data.e === "connected") {
            setIsAuthenticated(!!data.authenticated);
          }

          // Handle file events - invalidate React Query cache
          if (
            data.e === "file_created" ||
            data.e === "files_created" ||
            data.e === "file_deleted" ||
            data.e === "file_renamed"
          ) {
            queryClient.invalidateQueries({
              queryKey: ["projectFiles", projectId],
            });
          }

          if (data.e === "file_content_updated" || data.e === "file_read") {
            if (data.filepath) {
              queryClient.invalidateQueries({
                queryKey: ["fileContent", projectId, data.filepath],
              });
            }
          }

          if (data.e === "sandbox_created") {
            queryClient.invalidateQueries({
              queryKey: ["sandboxInfo", projectId],
            });
          }

          // Call custom message handler
          onMessage?.(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        isConnectingRef.current = false;
        setConnectionError("WebSocket connection error");
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        setIsAuthenticated(false);
        isConnectingRef.current = false;
        stopPingInterval();

        // Handle specific close codes
        if (event.code === 4001) {
          setConnectionError("Authentication required");
          // Don't reconnect on auth failures
          return;
        } else if (event.code === 4003) {
          setConnectionError("Access denied to this project");
          // Don't reconnect on access denied
          return;
        } else if (event.code === 4000) {
          setConnectionError("Invalid project ID");
          return;
        }

        // Only reconnect if we haven't exceeded max attempts
        if (
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
          wsRef.current !== null
        ) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
            30000
          );
          console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            if (
              wsRef.current === null ||
              wsRef.current.readyState === WebSocket.CLOSED
            ) {
              connect();
            }
          }, delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError("Failed to connect after multiple attempts");
          reconnectAttemptsRef.current = 0;
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      isConnectingRef.current = false;
      setConnectionError(
        error instanceof Error ? error.message : "Failed to connect"
      );
    }
  }, [projectId, onMessage, queryClient, startPingInterval, stopPingInterval]);

  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;
    stopPingInterval();

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      try {
        wsRef.current.close(1000, "Client disconnecting");
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsAuthenticated(false);
    setConnectionError(null);
  }, [stopPingInterval]);

  const sendMessage = useCallback((message: unknown) => {
    console.log("[WS Client] sendMessage called:", {
      messageType: typeof message === "object" && message !== null ? (message as any).type : "unknown",
      readyState: wsRef.current?.readyState,
      isOpen: wsRef.current?.readyState === WebSocket.OPEN,
      hasSocket: !!wsRef.current,
    });
    
    if (!wsRef.current) {
      console.error("[WS Client] ❌ No WebSocket reference");
      return false;
    }
    
    if (wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const messageStr = JSON.stringify(message);
        console.log("[WS Client] ✅ Sending message:", messageStr.slice(0, 200));
        wsRef.current.send(messageStr);
        return true;
      } catch (error) {
        console.error("[WS Client] ❌ Error sending message:", error);
        return false;
      }
    } else {
      console.warn("[WS Client] ⚠️ WebSocket not open, state:", wsRef.current.readyState, "(OPEN=1, CONNECTING=0, CLOSING=2, CLOSED=3)");
      return false;
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (!projectId) return;

    let mounted = true;
    
    // Connect with a small delay to avoid React Strict Mode double-invoke issues
    const connectTimeout = setTimeout(() => {
      if (mounted) {
        connect();
      }
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(connectTimeout);
      // Only disconnect if we're actually connected
      // This prevents React Strict Mode from closing connections prematurely
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Only reconnect when projectId changes

  return {
    isConnected,
    isAuthenticated,
    connectionError,
    sendMessage,
    connect,
    disconnect,
  };
}
