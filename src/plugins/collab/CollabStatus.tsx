/**
 * CollabStatus — a lightweight indicator of the collaboration connection
 * state shown in the editor's status bar area.
 *
 * Reads from the collab store and renders an appropriate icon + label.
 */

import { useCollabStore } from "./collabStore";
import type { CollabStatus, CollabTransport } from "./collabStore";

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

export function CollabStatusIndicator() {
  const status = useCollabStore((s) => s.status);
  const transport = useCollabStore((s) => s.transport);
  const users = useCollabStore((s) => s.connectedUsers);

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

      {/* Connected users */}
      {users.length > 0 && (
        <div className="flex items-center gap-1 ml-1">
          {users.map((user) => (
            <span
              key={user.clientId}
              className="inline-block w-4 h-4 rounded-full border border-background"
              style={{ backgroundColor: user.color }}
              title={user.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
