/**
 * CollabUsersList — a collapsible list of currently connected remote users.
 *
 * Shows each user's colour dot, name, and optional avatar.  The list updates
 * reactively via the collab store.
 */

import { useState } from "react";
import { useCollabStore } from "./collabStore";
import { CollabStatusIndicator } from "./CollabStatus";

export function CollabUsersList() {
  const [expanded, setExpanded] = useState(false);
  const users = useCollabStore((s) => s.connectedUsers);
  const status = useCollabStore((s) => s.status);

  // Don't render when disconnected
  if (status === "disconnected") return null;

  return (
    <div className="flex items-center gap-1">
      {/* Compact status indicator */}
      <CollabStatusIndicator />

      {/* User avatars row (always visible) */}
      {users.length > 0 && (
        <div className="flex items-center -space-x-1.5 ml-1">
          {users.slice(0, expanded ? undefined : 5).map((user) => (
            <div key={user.clientId} className="group relative">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-5 h-5 rounded-full border-2 border-background object-cover"
                  style={{ borderColor: user.color }}
                  title={user.name}
                />
              ) : (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full border-2 border-background text-[9px] font-bold text-white"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 text-[10px] rounded bg-popover text-popover-foreground shadow-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {user.name}
              </span>
            </div>
          ))}
          {users.length > 5 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="w-5 h-5 rounded-full border-2 border-background bg-muted text-[9px] font-medium text-muted-foreground hover:bg-accent transition-colors flex items-center justify-center"
              title={`Show all ${users.length} users`}
            >
              +{users.length - 5}
            </button>
          )}
        </div>
      )}

      {/* Offline changes indicator */}
      <OfflineIndicator />
    </div>
  );
}

/** Shows a badge when there are pending offline changes. */
function OfflineIndicator() {
  const pending = useCollabStore((s) => s.pendingOfflineChanges);
  const status = useCollabStore((s) => s.status);

  if (pending === 0 || status === "connected") return null;

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
      {pending} pending
    </span>
  );
}
