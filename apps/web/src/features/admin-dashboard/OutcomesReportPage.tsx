import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type OutcomeStat = { outcomeId: string; title: string; averageScore: number; sampleSize: number };

export function OutcomesReportPage() {
  const [outcomes, setOutcomes] = useState<OutcomeStat[] | null>(null);

  useEffect(() => {
    apiClient.get<{ outcomes: OutcomeStat[] }>("/api/reporting/outcomes").then((res) => setOutcomes(res.outcomes));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Öğrenme Çıktıları (Sınıf Geneli)</h1>
      <p className="text-sm text-muted-foreground">En zayıf kazanımlar üstte — sadece değerlendirilmiş yanıtlar sayılır.</p>
      <div className="flex flex-col gap-1.5">
        {(outcomes ?? []).map((outcome) => (
          <div key={outcome.outcomeId} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>{outcome.title}</span>
            <span className={outcome.averageScore < 60 ? "font-semibold text-destructive" : "font-semibold text-primary"}>
              {outcome.averageScore.toFixed(0)} / 100 ({outcome.sampleSize} yanıt)
            </span>
          </div>
        ))}
        {outcomes === null && <p className="text-muted-foreground">Yükleniyor...</p>}
        {outcomes?.length === 0 && <p className="text-muted-foreground">Henüz değerlendirilmiş yanıt yok.</p>}
      </div>
    </div>
  );
}
