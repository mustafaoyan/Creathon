import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type Dashboard = {
  examCompletion: { totalAssignments: number; submitted: number; graded: number };
  aiQuestionAcceptance: { totalAiGenerated: number; approved: number; rejected: number };
  aiScoringDeviation: { sampleSize: number; avgAbsDeviation: number | null };
};

// Önceden "Rol Görünümleri", "Öğrenme Çıktıları" ve "Giriş/Çıkış Kayıtları" de
// hep bu tek sayfadaydı, tek uzun kaydırmalı ekran gibi duruyordu. Kullanıcı
// isteğiyle her biri ayrı bir sayfaya taşındı (RoleViewsPage, OutcomesReportPage,
// AuditLogPage) ve ☰ menüsünde diğer rollerin çoklu sayfaları gibi ayrı ayrı
// listeleniyor (bkz. Sidebar.tsx) — bu sayfa artık sadece özet istatistikleri
// gösteriyor.
export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    apiClient.get<Dashboard>("/api/reporting/dashboard").then(setData);
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
          help="Gönderilen sınav denemesi / öğrencilere atanmış toplam sınav denemesi."
        />
        <StatCard
          label="AI Soru Kabul Oranı"
          value={`${data.aiQuestionAcceptance.approved}/${data.aiQuestionAcceptance.totalAiGenerated}`}
          help="İçerik uzmanının onayladığı AI tarafından üretilmiş soru / AI'nin ürettiği toplam soru."
        />
        <StatCard
          label="AI-Eğitmen Puan Sapması"
          value={data.aiScoringDeviation.avgAbsDeviation?.toFixed(1) ?? "-"}
          help="AI'nin verdiği puan ile eğitmenin son puanı arasındaki ortalama mutlak fark (0-100 puan üzerinden). Düşük değer, AI'nin eğitmene ne kadar yakın puanladığını gösterir."
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="rounded-md border border-border p-4" title={help}>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        <span
          className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-muted-foreground/50 text-[10px] leading-none"
          aria-label={help}
        >
          i
        </span>
      </p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
