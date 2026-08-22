import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type Dashboard = {
  examCompletion: { totalAssignments: number; submitted: number; graded: number };
  aiQuestionAcceptance: { totalAiGenerated: number; approved: number; rejected: number };
  aiScoringDeviation: { sampleSize: number; avgAbsDeviation: number | null };
};

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    apiClient.get<Dashboard>("/api/reporting/dashboard").then(setData);
  }, []);

  if (!data) return <p className="text-muted-foreground">Yükleniyor...</p>;

  return (
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
