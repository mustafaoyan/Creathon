import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type AuditEntry = {
  id: string;
  action: string;
  actorName: string;
  actorEmail: string;
  actorRole: string | null;
  createdAt: string;
};

export function AuditLogPage() {
  const [auditLog, setAuditLog] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    apiClient.get<{ entries: AuditEntry[] }>("/api/reporting/audit-log").then((res) => setAuditLog(res.entries));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Giriş / Çıkış Kayıtları</h1>
      <div className="flex flex-col gap-1.5">
        {(auditLog ?? []).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>
              <strong>{entry.actorName}</strong> ({entry.actorEmail}) ·{" "}
              {entry.action === "user.login" ? "giriş yaptı" : "çıkış yaptı"}
            </span>
            <span className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString("tr-TR")}</span>
          </div>
        ))}
        {auditLog === null && <p className="text-muted-foreground">Yükleniyor...</p>}
        {auditLog?.length === 0 && <p className="text-muted-foreground">Henüz kayıt yok.</p>}
      </div>
    </div>
  );
}
