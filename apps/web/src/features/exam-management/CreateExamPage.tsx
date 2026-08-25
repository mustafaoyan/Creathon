import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type QuestionRow = { id: string; body: string };
type StudentRow = { id: string; name: string; email: string };

export function CreateExamPage() {
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [approved, setApproved] = useState<QuestionRow[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  const [createdExamId, setCreatedExamId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [published, setPublished] = useState(false);
  const [assignStatus, setAssignStatus] = useState<string | null>(null);

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

  function toggleStudent(id: string) {
    setSelectedStudents((prev) => {
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
    setStatus("Sınav oluşturuldu (taslak) — aşağıdan yayınlayıp öğrenci atayabilirsin.");
    apiClient.get<{ students: StudentRow[] }>("/api/users/students").then((res) => setStudents(res.students));
  }

  async function publishAndAssign() {
    if (!createdExamId) return;
    setAssignStatus("Yayınlanıyor...");
    await apiClient.post(`/api/exams/${createdExamId}/publish`);
    setPublished(true);

    if (selectedStudents.size > 0) {
      await apiClient.post(`/api/exams/${createdExamId}/assign`, { studentIds: Array.from(selectedStudents) });
    }
    setAssignStatus(`Sınav yayınlandı ve ${selectedStudents.size} öğrenciye atandı.`);
  }

  if (createdExamId) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <h1 className="text-xl font-bold">Sınavı Yayınla ve Öğrenci Ata</h1>
        <p className="text-sm text-muted-foreground">{status}</p>

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Öğrenciler</h2>
          {students.map((student) => (
            <label key={student.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedStudents.has(student.id)}
                onChange={() => toggleStudent(student.id)}
              />
              {student.name} ({student.email})
            </label>
          ))}
          {students.length === 0 && (
            <p className="text-sm text-muted-foreground">Henüz aktif öğrenci yok — yine de sınavı yayınlayabilirsin.</p>
          )}
        </div>

        <Button onClick={publishAndAssign} disabled={published}>
          {published ? "Yayınlandı" : "Yayınla ve Ata"}
        </Button>
        {assignStatus && <p className="text-sm text-muted-foreground">{assignStatus}</p>}
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
          <label key={question.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedQuestions.has(question.id)}
              onChange={() => toggleQuestion(question.id)}
            />
            {question.body}
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
