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

// "i" rozeti önceden sadece native `title` (hover) tooltip'ine güveniyordu —
// dokunmatik ekranda hiç açılmıyordu, masaüstünde de fark edilmesi zordu
// (kullanıcı testinde bulundu: "bilgi çıkmıyor"). Artık RUBRIX NEDİR ile aynı
// tıkla-aç/kapa deseni: buton, açıklamayı görünür bir kutuda gösteriyor.
function StatCard({ label, value, help }: { label: string; value: string; help: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative rounded-md border border-border p-4">
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        {label}
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={`${label} açıklaması`}
          className="inline-flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-full border border-muted-foreground/50 text-[10px] leading-none hover:border-primary hover:text-primary"
        >
          i
        </button>
      </p>
      <p className="text-2xl font-bold">{value}</p>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 w-64 rounded-md border border-border bg-background p-3 text-xs text-foreground shadow-lg">
          {help}
        </div>
      )}
    </div>
  );
}
