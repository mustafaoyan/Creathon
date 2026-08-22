import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type PendingReview = {
  studentAnswerId: string;
  questionBody: string;
  answerText: string;
  suggestedScore: number;
  justification: string;
};

export function GradingReviewPage() {
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    apiClient.get<{ pending: PendingReview[] }>("/api/grading/pending").then((res) => setPending(res.pending));
  }, []);

  async function finalize(id: string) {
    const score = scores[id];
    await apiClient.post(`/api/grading/${id}/finalize`, { score });
    setPending((prev) => prev.filter((item) => item.studentAnswerId !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">Puanlama Onayı (İnsan Kontrolü)</h1>
      {pending.map((item) => (
        <div key={item.studentAnswerId} className="rounded-md border border-border p-4">
          <p className="font-medium">{item.questionBody}</p>
          <p className="mt-2 text-sm">{item.answerText}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            AI önerisi: {item.suggestedScore} — {item.justification}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              className="w-24 rounded-md border border-input px-2 py-1"
              defaultValue={item.suggestedScore}
              onChange={(event) =>
                setScores((prev) => ({ ...prev, [item.studentAnswerId]: Number(event.target.value) }))
              }
            />
            <Button size="sm" onClick={() => finalize(item.studentAnswerId)}>
              Notu Onayla
            </Button>
          </div>
        </div>
      ))}
      {pending.length === 0 && <p className="text-muted-foreground">Bekleyen değerlendirme yok.</p>}
    </div>
  );
}
