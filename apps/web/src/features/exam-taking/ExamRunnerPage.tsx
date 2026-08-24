import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type Assignment = {
  id: string;
  examId: string;
  title: string;
  status: string;
  totalScore: number | null;
  submittedAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "Atandı",
  in_progress: "Devam ediyor",
  submitted: "Gönderildi — açık uçlu sorular değerlendiriliyor",
  graded: "Değerlendirildi",
};
type ExamOption = { id: string; label: string; body: string };
type ExamQuestion = {
  id: string;
  questionId: string;
  body: string;
  type: string;
  points: number;
  options?: ExamOption[];
};

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

  async function saveAnswer(questionId: string, payload: { selectedOptionId?: string; answerText?: string }) {
    setAnswers((prev) => ({ ...prev, [questionId]: payload.selectedOptionId ?? payload.answerText ?? "" }));
    if (!active) return;
    await apiClient.post(`/api/exams/attempts/${active.attemptId}/answers`, { questionId, ...payload });
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
            {question.type === "multiple_choice" && question.options ? (
              <div className="mt-2 flex flex-col gap-2">
                {question.options.map((option) => (
                  <label key={option.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={question.questionId}
                      checked={answers[question.questionId] === option.id}
                      onChange={() => saveAnswer(question.questionId, { selectedOptionId: option.id })}
                    />
                    <span>
                      {option.label}. {option.body}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                className="mt-2 w-full rounded-md border border-input px-3 py-2"
                value={answers[question.questionId] ?? ""}
                onChange={(event) => saveAnswer(question.questionId, { answerText: event.target.value })}
              />
            )}
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
          <div>
            <p>{assignment.title}</p>
            <p className="text-sm text-muted-foreground">{STATUS_LABELS[assignment.status] ?? assignment.status}</p>
            {(assignment.status === "submitted" || assignment.status === "graded") &&
              assignment.totalScore !== null && (
                <p className="text-sm font-semibold text-primary">
                  Puan: {assignment.totalScore.toFixed(1)}
                  {assignment.status === "submitted" && " (kısmi — açık uçlu sorular onaylanınca güncellenecek)"}
                </p>
              )}
          </div>
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
