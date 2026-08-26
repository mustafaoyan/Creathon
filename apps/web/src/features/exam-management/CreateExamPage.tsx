import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { getSelectedQuestionIds, clearSelectedQuestionIds } from "./examPoolSelection";

export function CreateExamPage() {
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [selectedCount, setSelectedCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const [createdExamId, setCreatedExamId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  // Soru Havuzu artık ayrı bir sayfa (/exams/pool) — buraya dönünce (tam sayfa
  // yenilemeyle) seçim sayısını sessionStorage'dan okuyoruz, bkz. examPoolSelection.ts.
  useEffect(() => {
    setSelectedCount(getSelectedQuestionIds().size);
  }, []);

  async function createExam() {
    setStatus("Oluşturuluyor...");
    const { id } = await apiClient.post<{ id: string }>("/api/exams", {
      title,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      questionIds: Array.from(getSelectedQuestionIds()).map((questionId) => ({ questionId, points: 10 })),
    });
    clearSelectedQuestionIds();
    setCreatedExamId(id);
    setStatus(null);
  }

  // Öğrenci elle seçilmiyor — yayınlanan sınav, öğrenci olarak giren herkese
  // görünüyor (bkz. exams.service.ts#listForStudent — sunucu tarafında).
  async function publish() {
    if (!createdExamId) return;
    await apiClient.post(`/api/exams/${createdExamId}/publish`);
    setPublished(true);
    toast.success("Sınav yayınlandı — tüm öğrenciler artık görebilir.");
  }

  if (createdExamId) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <h1 className="text-xl font-bold">Sınavı Yayınla</h1>
        <p className="text-sm text-muted-foreground">
          Sınav oluşturuldu (taslak). Yayınladığında öğrenci olarak giren herkes "Sınavlarım"
          listesinde görüp girebilecek.
        </p>

        <Button onClick={publish} disabled={published}>
          {published ? "Yayınlandı" : "Yayınla"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-xl font-bold">Yeni Sınav Oluştur</h1>
      <input
        className="rounded-md border border-input px-3 py-2"
        placeholder="Sınav başlığı"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        className="rounded-md border border-input px-3 py-2"
        type="number"
        min={1}
        placeholder="Süre (dakika, boş bırakılırsa süresiz)"
        value={durationMinutes}
        onChange={(event) => setDurationMinutes(event.target.value)}
      />

      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-accent/40 px-4 py-3">
        <p className="text-sm font-medium">{selectedCount} soru seçildi</p>
        <Button onClick={createExam} disabled={!title || selectedCount === 0}>
          Sınavı Oluştur
        </Button>
      </div>

      <a href="/exams/pool">
        <Button type="button" variant="outline" className="w-full">
          Soru Havuzu
        </Button>
      </a>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
