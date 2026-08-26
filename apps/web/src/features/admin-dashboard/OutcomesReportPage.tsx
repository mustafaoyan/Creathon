import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type OutcomeStat = {
  outcomeId: string;
  title: string;
  createdAt: string;
  averageScore: number;
  sampleSize: number;
  studentCount: number;
  exams: { id: string; title: string }[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function OutcomesReportPage() {
  const [outcomes, setOutcomes] = useState<OutcomeStat[] | null>(null);

  useEffect(() => {
    apiClient.get<{ outcomes: OutcomeStat[] }>("/api/reporting/outcomes").then((res) => setOutcomes(res.outcomes));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Öğrenme Çıktıları (Sınıf Geneli)</h1>
      <p className="text-sm text-muted-foreground">En zayıf kazanımlar üstte — sadece değerlendirilmiş yanıtlar sayılır.</p>
      <div className="flex flex-col gap-2">
        {(outcomes ?? []).map((outcome) => (
          <div key={outcome.outcomeId} className="flex flex-col gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{outcome.title}</span>
              <span className={outcome.averageScore < 60 ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                {outcome.averageScore.toFixed(0)} / 100 ({outcome.sampleSize} yanıt)
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Oluşturulma: {formatDate(outcome.createdAt)}</span>
              <span>{outcome.studentCount} öğrenci girdi</span>
              <span>
                Sınav{outcome.exams.length > 1 ? "lar" : ""}: {outcome.exams.map((exam) => exam.title).join(", ")}
              </span>
            </div>
          </div>
        ))}
        {outcomes === null && <p className="text-muted-foreground">Yükleniyor...</p>}
        {outcomes?.length === 0 && <p className="text-muted-foreground">Henüz değerlendirilmiş yanıt yok.</p>}
      </div>
    </div>
  );
}
