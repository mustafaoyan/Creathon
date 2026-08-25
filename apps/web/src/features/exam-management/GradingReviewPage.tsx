import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type CriterionBreakdown = { criterionId: string; criterion: string; score: number; comment: string };

type PendingReview = {
  studentAnswerId: string;
  questionBody: string;
  answerText: string;
  suggestedScore: number;
  justification: string;
  criteriaBreakdown: CriterionBreakdown[];
};

export function GradingReviewPage() {
  const [pending, setPending] = useState<PendingReview[]>([]);
  // Hangi kartın "Puanı Düzenle" moduna açıldığı — açılana kadar sadece
  // "Puanı Onayla" (AI'nin önerisini olduğu gibi kabul et) görünüyor; brief'in
  // istediği iki ayrı eylem (onayla / düzenle) burada net şekilde ayrışıyor.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftScore, setDraftScore] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState("");

  useEffect(() => {
    apiClient.get<{ pending: PendingReview[] }>("/api/grading/pending").then((res) => setPending(res.pending));
  }, []);

  async function finalize(id: string, score: number, reason?: string) {
    await apiClient.post(`/api/grading/${id}/finalize`, { score, overrideReason: reason });
    setPending((prev) => prev.filter((item) => item.studentAnswerId !== id));
    setEditingId(null);
  }

  function startEditing(item: PendingReview) {
    setEditingId(item.studentAnswerId);
    setDraftScore(item.suggestedScore);
    setOverrideReason("");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-bold">AI Destekli Değerlendirme Sistemi</h1>
        <p className="text-sm text-muted-foreground">İnsan kontrolü — AI önerilerini incele, onayla veya düzenle.</p>
      </div>
      {pending.map((item) => {
        const isEditing = editingId === item.studentAnswerId;

        return (
          <div key={item.studentAnswerId} className="rounded-md border border-border p-4">
            <p className="font-medium">{item.questionBody}</p>
            <p className="mt-2 text-sm">{item.answerText}</p>

            <div className="mt-3 rounded-md bg-secondary/40 p-3 text-sm">
              <p className="font-semibold">AI önerisi: {item.suggestedScore}</p>
              <p className="mt-1 text-muted-foreground">{item.justification}</p>
              {item.criteriaBreakdown.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-left">
                  {item.criteriaBreakdown.map((c) => (
                    <li key={c.criterionId} className="text-muted-foreground">
                      <span className="font-medium text-foreground">{c.criterion}:</span> {c.score} — {c.comment}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {isEditing ? (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-24 rounded-md border border-input px-2 py-1"
                    value={draftScore}
                    onChange={(event) => setDraftScore(Number(event.target.value))}
                  />
                  <input
                    type="text"
                    placeholder="Değişiklik gerekçesi (opsiyonel)"
                    className="flex-1 rounded-md border border-input px-2 py-1 text-sm"
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => finalize(item.studentAnswerId, draftScore, overrideReason || undefined)}>
                    Değişikliği Kaydet
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Vazgeç
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => finalize(item.studentAnswerId, item.suggestedScore)}>
                  Puanı Onayla
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEditing(item)}>
                  Puanı Düzenle
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {pending.length === 0 && <p className="text-muted-foreground">Bekleyen değerlendirme yok.</p>}
    </div>
  );
}
