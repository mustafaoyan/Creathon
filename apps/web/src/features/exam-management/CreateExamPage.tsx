import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type QuestionRow = { id: string; body: string };

export function CreateExamPage() {
  const [title, setTitle] = useState("");
  const [approved, setApproved] = useState<QuestionRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ questions: QuestionRow[] }>("/api/questions?status=approved")
      .then((res) => setApproved(res.questions));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createExam() {
    setStatus("Oluşturuluyor...");
    await apiClient.post("/api/exams", {
      title,
      questionIds: Array.from(selected).map((questionId) => ({ questionId, points: 10 })),
    });
    setStatus("Sınav oluşturuldu (taslak). Yayınlamak ve öğrenci atamak için sınav listesine dönün.");
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      <h1 className="text-xl font-bold">Yeni Sınav Oluştur</h1>
      <input
        className="rounded-md border border-input px-3 py-2"
        placeholder="Sınav başlığı"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="flex flex-col gap-2">
        {approved.map((question) => (
          <label key={question.id} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.has(question.id)} onChange={() => toggle(question.id)} />
            {question.body}
          </label>
        ))}
      </div>
      <Button onClick={createExam} disabled={!title || selected.size === 0}>
        Sınavı Oluştur
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
