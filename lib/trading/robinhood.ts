import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentConfig } from "@/lib/db/schema";
import type { AgentConfig } from "@/lib/db/schema";

// A heartbeat is "live" only if the agent pinged within this window. The agent
// pings at the start of each wake (well under the 30-min poll interval), so a
// real trade is always backed by a connection that was verified seconds earlier.
// If no agent session with the MCP is running, the heartbeat goes stale and the
// real-money gate closes — which is the correct, fail-safe behavior.
export const ROBINHOOD_HEARTBEAT_TTL_MS = 10 * 60 * 1000;

export function isRobinhoodLive(cfg: AgentConfig, now = Date.now()): boolean {
  if (!cfg.robinhoodConnectedAt) return false;
  return now - cfg.robinhoodConnectedAt.getTime() <= ROBINHOOD_HEARTBEAT_TTL_MS;
}

export interface RobinhoodStatus {
  connected: boolean;
  connectedAt: string | null;
  account: string | null;
  ageSeconds: number | null;
  ttlSeconds: number;
}

export function getRobinhoodStatus(cfg: AgentConfig, now = Date.now()): RobinhoodStatus {
  const at = cfg.robinhoodConnectedAt?.getTime() ?? null;
  return {
    connected: isRobinhoodLive(cfg, now),
    connectedAt: cfg.robinhoodConnectedAt?.toISOString() ?? null,
    account: cfg.robinhoodAccount ?? null,
    ageSeconds: at != null ? Math.floor((now - at) / 1000) : null,
    ttlSeconds: Math.floor(ROBINHOOD_HEARTBEAT_TTL_MS / 1000),
  };
}

/** The agent records a fresh heartbeat after verifying the MCP (e.g. getAccount). */
export function recordHeartbeat(account?: string | null): AgentConfig {
  const db = getDb();
  db.update(agentConfig)
    .set({
      robinhoodConnectedAt: new Date(),
      ...(account !== undefined ? { robinhoodAccount: account } : {}),
      updatedAt: new Date(),
    })
    .where(eq(agentConfig.id, 1))
    .run();
  return db.select().from(agentConfig).where(eq(agentConfig.id, 1)).get()!;
}

/** Drop the connection (agent disconnecting, or user forcing the gate shut). */
export function clearHeartbeat(): AgentConfig {
  const db = getDb();
  db.update(agentConfig)
    .set({ robinhoodConnectedAt: null, robinhoodAccount: null, updatedAt: new Date() })
    .where(eq(agentConfig.id, 1))
    .run();
  return db.select().from(agentConfig).where(eq(agentConfig.id, 1)).get()!;
}
