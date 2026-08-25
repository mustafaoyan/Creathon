import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type Assignment = {
  id: string;
  examId: string;
  title: string;
  status: string;
  durationMinutes: number | null;
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

function formatRemaining(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ExamRunnerPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [active, setActive] = useState<{
    examId: string;
    attemptId: string;
    questions: ExamQuestion[];
    deadline: number | null;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    apiClient.get<{ assignments: Assignment[] }>("/api/exams/my").then((res) => setAssignments(res.assignments));
  }, []);

  async function start(examId: string) {
    const result = await apiClient.post<{
      attempt: { id: string; startedAt: string };
      questions: ExamQuestion[];
      durationMinutes: number | null;
    }>(`/api/exams/${examId}/attempts`);
    const deadline = result.durationMinutes
      ? new Date(result.attempt.startedAt).getTime() + result.durationMinutes * 60_000
      : null;
    setActive({ examId, attemptId: result.attempt.id, questions: result.questions, deadline });
  }

  // Süre dolunca otomatik gönderiliyor — sunucu da aynı süreyi ayrıca
  // doğruluyor (assertAttemptNotExpired), bu sadece öğrenciye görünen sayaç.
  useEffect(() => {
    if (!active?.deadline) {
      setRemainingSeconds(null);
      return;
    }
    const deadline = active.deadline;
    const tick = () => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs === 0) submit();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.deadline]);

  const timeIsUp = remainingSeconds === 0;

  async function saveAnswer(questionId: string, payload: { selectedOptionId?: string; answerText?: string }) {
    if (timeIsUp || !active) return;
    setAnswers((prev) => ({ ...prev, [questionId]: payload.selectedOptionId ?? payload.answerText ?? "" }));
    try {
      await apiClient.post(`/api/exams/attempts/${active.attemptId}/answers`, { questionId, ...payload });
    } catch {
      // Süre tam bu sırada dolduysa sunucu reddeder — sayaç zaten kilitleyecek, sessizce yut.
    }
  }

  async function submit() {
    if (!active) return;
    await apiClient.post(`/api/exams/${active.examId}/attempts/${active.attemptId}/submit`);
    setActive(null);
  }

  if (active) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        {remainingSeconds !== null && (
          <p className={`text-sm font-semibold ${remainingSeconds <= 60 ? "text-destructive" : "text-muted-foreground"}`}>
            Kalan süre: {formatRemaining(remainingSeconds)}
          </p>
        )}
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
                      disabled={timeIsUp}
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
                disabled={timeIsUp}
                value={answers[question.questionId] ?? ""}
                onChange={(event) => saveAnswer(question.questionId, { answerText: event.target.value })}
              />
            )}
          </div>
        ))}
        <Button onClick={submit} disabled={timeIsUp}>
          Sınavı Bitir
        </Button>
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
