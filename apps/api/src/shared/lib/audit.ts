import type { Database } from "../db/client";
import { auditLogs } from "../db/schema";
import { newId } from "./id";

export async function recordAuditLog(
  db: Database,
  entry: { actorId: string; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> },
) {
  await db.insert(auditLogs).values({
    id: newId("audit"),
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    createdAt: new Date(),
  });
}
