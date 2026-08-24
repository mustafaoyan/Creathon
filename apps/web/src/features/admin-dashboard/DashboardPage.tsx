import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type Dashboard = {
  examCompletion: { totalAssignments: number; submitted: number; graded: number };
  aiQuestionAcceptance: { totalAiGenerated: number; approved: number; rejected: number };
  aiScoringDeviation: { sampleSize: number; avgAbsDeviation: number | null };
};

type AuditEntry = {
  id: string;
  action: string;
  actorName: string;
  actorEmail: string;
  actorRole: string | null;
  createdAt: string;
};

const ROLE_VIEWS = [
  { href: "/content/upload", label: "İçerik Uzmanı gözüyle" },
  { href: "/exams/new", label: "Eğitmen gözüyle" },
  { href: "/exams/take", label: "Öğrenci gözüyle" },
];

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    apiClient.get<Dashboard>("/api/reporting/dashboard").then(setData);
    apiClient.get<{ entries: AuditEntry[] }>("/api/reporting/audit-log").then((res) => setAuditLog(res.entries));
  }, []);

  if (!data) return <p className="text-muted-foreground">Yükleniyor...</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Yönetici Paneli</h1>
        <a href="/admin/users" className="text-sm font-medium text-primary underline">
          Kullanıcı Yönetimi
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Sınav Tamamlanma"
          value={`${data.examCompletion.submitted}/${data.examCompletion.totalAssignments}`}
        />
        <StatCard
          label="AI Soru Kabul Oranı"
          value={`${data.aiQuestionAcceptance.approved}/${data.aiQuestionAcceptance.totalAiGenerated}`}
        />
        <StatCard
          label="AI-Eğitmen Puan Sapması"
          value={data.aiScoringDeviation.avgAbsDeviation?.toFixed(1) ?? "-"}
        />
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Rol Görünümleri</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Yönetici olarak diğer rollerin ekranlarını, ayrı bir hesaba giriş yapmadan gezebilirsin.
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLE_VIEWS.map((view) => (
            <a
              key={view.href}
              href={view.href}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              {view.label}
            </a>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Giriş / Çıkış Kayıtları</h2>
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
          {auditLog?.length === 0 && <p className="text-muted-foreground">Henüz kayıt yok.</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
