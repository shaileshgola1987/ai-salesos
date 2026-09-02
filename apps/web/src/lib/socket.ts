import { io, type Socket } from "socket.io-client";
import { API_URL, getToken } from "./api";

// API_URL is e.g. "http://localhost:4000/api" — the gateway lives at the server root
// under the "whatsapp" namespace, not behind the REST "/api" prefix.
const SOCKET_BASE = API_URL.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

/** Lazily connects (or reuses) the WhatsApp Inbox real-time socket for the current session. */
export function getWhatsAppSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;

  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(`${SOCKET_BASE}/whatsapp`, {
    auth: { token },
    transports: ["websocket"],
  });
  return socket;
}

export function disconnectWhatsAppSocket() {
  socket?.disconnect();
  socket = null;
}
