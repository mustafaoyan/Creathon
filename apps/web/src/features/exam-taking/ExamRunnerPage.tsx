import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type Assignment = { id: string; examId: string; title: string; status: string };
type ExamQuestion = { id: string; questionId: string; body: string; type: string; points: number };

export function ExamRunnerPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [active, setActive] = useState<{ examId: string; attemptId: string; questions: ExamQuestion[] } | null>(
    null,
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    apiClient.get<{ assignments: Assignment[] }>("/api/exams/my").then((res) => setAssignments(res.assignments));
  }, []);

  async function start(examId: string) {
    const result = await apiClient.post<{ attempt: { id: string }; questions: ExamQuestion[] }>(
      `/api/exams/${examId}/attempts`,
    );
    setActive({ examId, attemptId: result.attempt.id, questions: result.questions });
  }

  async function saveAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    if (!active) return;
    await apiClient.post(`/api/exams/attempts/${active.attemptId}/answers`, { questionId, answerText: value });
  }

  async function submit() {
    if (!active) return;
    await apiClient.post(`/api/exams/${active.examId}/attempts/${active.attemptId}/submit`);
    setActive(null);
  }

  if (active) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        {active.questions.map((question) => (
          <div key={question.id}>
            <p className="font-medium">{question.body}</p>
            {/* NOT: çoktan seçmeli seçenek UI'ı sonraki iterasyonda eklenecek; şimdilik tüm soru
                tipleri serbest metin alanıyla yanıtlanıyor. */}
            <textarea
              className="mt-2 w-full rounded-md border border-input px-3 py-2"
              value={answers[question.questionId] ?? ""}
              onChange={(event) => saveAnswer(question.questionId, event.target.value)}
            />
          </div>
        ))}
        <Button onClick={submit}>Sınavı Bitir</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Atanan Sınavlarım</h1>
      {assignments.map((assignment) => (
        <div key={assignment.id} className="flex items-center justify-between rounded-md border border-border p-4">
          <span>
            {assignment.title} — {assignment.status}
          </span>
          {assignment.status === "assigned" || assignment.status === "in_progress" ? (
            <Button size="sm" onClick={() => start(assignment.examId)}>
              Sınava Başla
            </Button>
          ) : null}
        </div>
      ))}
      {assignments.length === 0 && <p className="text-muted-foreground">Atanmış sınav yok.</p>}
    </div>
  );
}
