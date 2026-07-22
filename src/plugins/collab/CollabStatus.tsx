/**
 * CollabStatus — connection state indicator with quality metrics.
 *
 * Shows the collaboration connection state, transport type, latency,
 * bandwidth, and connected user avatars.
 *
 * ---
 * Phase 5.1: Latency, bandwidth, connection quality display.
 * Phase 5.2: Session info, collaborator roles.
 * Phase 5.3: Typing indicators, section info.
 */

import { useCollabStore } from "./collabStore";
import type { CollabStatus, CollabTransport, ConnectionQuality } from "./collabStore";

const statusConfig: Record<CollabStatus, { label: string; dotClass: string }> = {
  connected: { label: "Connected", dotClass: "bg-green-500" },
  connecting: { label: "Connecting…", dotClass: "bg-yellow-500 animate-pulse" },
  reconnecting: { label: "Reconnecting…", dotClass: "bg-yellow-500 animate-pulse" },
  disconnected: { label: "Disconnected", dotClass: "bg-gray-400" },
};

const transportLabel: Record<CollabTransport, string> = {
  broadcast: "Local",
  websocket: "WebSocket",
  webrtc: "WebRTC",
};

const qualityColors: Record<ConnectionQuality, string> = {
  excellent: "text-green-500",
  good: "text-blue-500",
  fair: "text-yellow-500",
  poor: "text-red-500",
};

/** Format bytes to human-readable. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B/s`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function CollabStatusIndicator() {
  const status = useCollabStore((s) => s.status);
  const transport = useCollabStore((s) => s.transport);
  const users = useCollabStore((s) => s.connectedUsers);
  const latency = useCollabStore((s) => s.latency);
  const quality = useCollabStore((s) => s.connectionQuality);
  const bandwidth = useCollabStore((s) => s.bandwidth);
  const localRole = useCollabStore((s) => s.localRole);

  const cfg = statusConfig[status];

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1 rounded-md hover:bg-accent/50 transition-colors">
      {/* Status dot */}
      <span className={`inline-block w-2 h-2 rounded-full ${cfg.dotClass}`} title={cfg.label} />

      {/* Status label */}
      <span className="font-medium">{cfg.label}</span>

      {/* Transport type */}
      <span className="text-[10px] uppercase tracking-wider opacity-60">
        {transportLabel[transport]}
      </span>

      {/* Role badge */}
      {localRole && localRole !== "editor" && (
        <span
          className={`text-[9px] uppercase tracking-wider font-bold px-1 py-0.5 rounded ${
            localRole === "admin"
              ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
              : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
          }`}
        >
          {localRole}
        </span>
      )}

      {/* Latency */}
      {status === "connected" && latency > 0 && (
        <span className={`text-[10px] tabular-nums ${qualityColors[quality]}`} title="Latency">
          {latency}ms
        </span>
      )}

      {/* Bandwidth */}
      {status === "connected" && bandwidth > 0 && (
        <span className="text-[10px] text-muted-foreground/60 tabular-nums" title="Bandwidth">
          {formatBytes(bandwidth)}
        </span>
      )}

      {/* Connected users */}
      {users.length > 0 && (
        <div className="flex items-center gap-1 ml-1">
          {users.map((user) => (
            <span
              key={user.clientId}
              className="inline-block w-4 h-4 rounded-full border border-background relative group"
              style={{ backgroundColor: user.color }}
              title={`${user.name}${user.role && user.role !== "editor" ? ` (${user.role})` : ""}${user.isTyping ? " — typing…" : ""}`}
            >
              {/* Typing indicator pulse */}
              {user.isTyping && (
                <span className="absolute inset-0 rounded-full animate-ping bg-white/40" />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
