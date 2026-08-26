import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type Assignment = {
  id: string;
  examId: string;
  title: string;
  status: string;
  totalScore: number | null;
  submittedAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "Henüz başlamadın",
  in_progress: "Devam ediyor",
  submitted: "Gönderildi — açık uçlu sorular değerlendiriliyor",
  graded: "Değerlendirildi",
};

/** Öğrencinin "Sonucum" sekmesi — Sınavlarım'dan ayrı, sadece sonuca odaklı bir
 * özet (kullanıcı isteği: sonucu ayrıca ızgara menüde görsün). Aynı
 * /api/exams/my verisini kullanıyor, burada sadece sunum farklı. */
export function StudentResultsPage() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);

  useEffect(() => {
    apiClient.get<{ assignments: Assignment[] }>("/api/exams/my").then((res) => setAssignments(res.assignments));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-xl font-bold">Sonucum</h1>
      <div className="flex flex-col gap-1.5">
        {(assignments ?? []).map((assignment) => (
          <div key={assignment.id} className="rounded-md border border-border p-4">
            <p className="font-medium">{assignment.title}</p>
            <p className="text-sm text-muted-foreground">{STATUS_LABELS[assignment.status] ?? assignment.status}</p>
            {(assignment.status === "submitted" || assignment.status === "graded") && assignment.totalScore !== null && (
              <p className="mt-1 text-lg font-semibold text-primary">{assignment.totalScore.toFixed(1)} puan</p>
            )}
          </div>
        ))}
        {assignments === null && <p className="text-muted-foreground">Yükleniyor...</p>}
        {assignments?.length === 0 && <p className="text-muted-foreground">Henüz atanmış sınav yok.</p>}
      </div>
    </div>
  );
}
