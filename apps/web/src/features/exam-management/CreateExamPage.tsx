import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type QuestionRow = { id: string; body: string };

export function CreateExamPage() {
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [approved, setApproved] = useState<QuestionRow[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  const [createdExamId, setCreatedExamId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ questions: QuestionRow[] }>("/api/questions?status=approved")
      .then((res) => setApproved(res.questions));
  }, []);

  function toggleQuestion(id: string) {
    setSelectedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createExam() {
    setStatus("Oluşturuluyor...");
    const { id } = await apiClient.post<{ id: string }>("/api/exams", {
      title,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      questionIds: Array.from(selectedQuestions).map((questionId) => ({ questionId, points: 10 })),
    });
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
      <div className="flex flex-col gap-2">
        {approved.map((question) => (
          <label key={question.id} className="flex items-start gap-2 text-left">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={selectedQuestions.has(question.id)}
              onChange={() => toggleQuestion(question.id)}
            />
            <span>{question.body}</span>
          </label>
        ))}
        {approved.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Onaylanmış soru yok — önce içerik uzmanının soru üretip onaylaması gerekiyor.
          </p>
        )}
      </div>
      <Button onClick={createExam} disabled={!title || selectedQuestions.size === 0}>
        Sınavı Oluştur
      </Button>
      {status && !createdExamId && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
