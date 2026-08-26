import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

type ExamRow = { id: string; title: string; status: string; createdAt: string };
type ResultRow = {
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  status: string;
  totalScore: number | null;
  submittedAt: string | null;
};
type OptionRow = { id: string; label: string; body: string; isCorrect: boolean };
type AnswerRow = {
  examQuestionId: string;
  orderIndex: number;
  points: number;
  questionId: string;
  questionBody: string;
  questionType: "multiple_choice" | "open_ended";
  selectedOptionId: string | null;
  answerText: string | null;
  aiSuggestedScore: number | null;
  aiJustification: string | null;
  aiCriteriaBreakdown: string | null;
  finalScore: number | null;
  options?: OptionRow[];
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "Atandı",
  in_progress: "Devam ediyor",
  submitted: "Gönderildi — değerlendiriliyor",
  graded: "Değerlendirildi",
};

/** Eğitmenin "Sonuçlar" ekranı — üç seviye: sınavlarım -> o sınava giren her
 * öğrenci (isme göre sıralı) -> bir öğrencinin cevap + AI değerlendirme detayı.
 * Hepsi tek sayfada, tam sayfa yenilemesi gerekmeden (Soru Havuzu'ndan farklı
 * olarak burada birden fazla route'a yayılan bir seçim biriktirme yok). */
export function ExamResultsPage() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerRow[] | null>(null);

  useEffect(() => {
    apiClient.get<{ exams: ExamRow[] }>("/api/exams").then((res) => setExams(res.exams));
  }, []);

  function openExam(examId: string) {
    setActiveExamId(examId);
    setActiveStudentId(null);
    setResults(null);
    apiClient.get<{ results: ResultRow[] }>(`/api/exams/${examId}/results`).then((res) => setResults(res.results));
  }

  function openStudent(studentId: string) {
    if (!activeExamId) return;
    setActiveStudentId(studentId);
    setAnswers(null);
    apiClient
      .get<{ answers: AnswerRow[] }>(`/api/exams/${activeExamId}/results/${studentId}`)
      .then((res) => setAnswers(res.answers));
  }

  const activeExam = exams.find((exam) => exam.id === activeExamId);
  const activeResult = results?.find((result) => result.studentId === activeStudentId);

  if (activeStudentId && activeExam) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <button
          type="button"
          onClick={() => setActiveStudentId(null)}
          className="w-fit cursor-pointer text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          ← {activeExam.title} Sonuçlarına Dön
        </button>
        <div>
          <h1 className="text-xl font-bold">{activeResult?.studentName}</h1>
          <p className="text-sm text-muted-foreground">
            {activeResult?.studentEmail}
            {activeResult?.totalScore !== null && activeResult?.totalScore !== undefined && (
              <> · Toplam: {activeResult.totalScore.toFixed(1)} puan</>
            )}
          </p>
        </div>

        {(answers ?? []).map((answer) => (
          <div key={answer.examQuestionId} className="rounded-md border border-primary/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{answer.questionBody}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{answer.points} puan</span>
            </div>

            {answer.questionType === "multiple_choice" ? (
              <div className="mt-2 flex flex-col gap-1">
                {(answer.options ?? []).map((option) => {
                  const wasSelected = option.id === answer.selectedOptionId;
                  return (
                    <p
                      key={option.id}
                      className={`rounded px-2 py-1 text-sm ${
                        option.isCorrect
                          ? "bg-primary/15 font-medium text-primary"
                          : wasSelected
                            ? "bg-destructive/10 text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {option.label}. {option.body}
                      {option.isCorrect && " ✓ doğru cevap"}
                      {wasSelected && " ← öğrencinin cevabı"}
                    </p>
                  );
                })}
                {!answer.selectedOptionId && <p className="mt-1 text-sm text-muted-foreground">Cevaplanmamış.</p>}
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <p className="text-sm">{answer.answerText || "Cevaplanmamış."}</p>
                {answer.aiSuggestedScore !== null && (
                  <div className="rounded-md bg-secondary/40 p-3 text-sm">
                    <p className="font-semibold">
                      AI önerisi: {answer.aiSuggestedScore}
                      {answer.finalScore !== null && answer.finalScore !== answer.aiSuggestedScore && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          (eğitmen puanı: {answer.finalScore})
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-muted-foreground">{answer.aiJustification}</p>
                    {answer.aiCriteriaBreakdown && (
                      <ul className="mt-2 flex flex-col gap-1 text-left">
                        {(JSON.parse(answer.aiCriteriaBreakdown) as { score: number; comment: string }[]).map(
                          (criterion, index) => (
                            <li key={index} className="text-muted-foreground">
                              {criterion.score} — {criterion.comment}
                            </li>
                          ),
                        )}
                      </ul>
                    )}
                  </div>
                )}
                {answer.finalScore !== null && answer.aiSuggestedScore === null && (
                  <p className="text-sm font-semibold text-primary">Puan: {answer.finalScore}</p>
                )}
              </div>
            )}
          </div>
        ))}
        {answers === null && <p className="text-muted-foreground">Yükleniyor...</p>}
      </div>
    );
  }

  if (activeExamId) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <button
          type="button"
          onClick={() => setActiveExamId(null)}
          className="w-fit cursor-pointer text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          ← Sınavlarıma Dön
        </button>
        <h1 className="text-xl font-bold">{activeExam?.title}</h1>
        <div className="flex flex-col gap-1.5">
          {(results ?? []).map((result) => (
            <button
              key={result.studentId}
              type="button"
              onClick={() => openStudent(result.studentId)}
              className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <span>
                <span className="font-medium">{result.studentName}</span>{" "}
                <span className="text-muted-foreground">({result.studentEmail})</span>
              </span>
              <span className="text-muted-foreground">
                {STATUS_LABELS[result.status] ?? result.status}
                {result.totalScore !== null && ` · ${result.totalScore.toFixed(1)} puan`}
              </span>
            </button>
          ))}
          {results === null && <p className="text-muted-foreground">Yükleniyor...</p>}
          {results?.length === 0 && <p className="text-muted-foreground">Bu sınava henüz giren olmadı.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-xl font-bold">Sonuçlar</h1>
      <div className="flex flex-col gap-1.5">
        {exams.map((exam) => (
          <button
            key={exam.id}
            type="button"
            onClick={() => openExam(exam.id)}
            className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <span className="font-medium">{exam.title}</span>
            <span className="text-muted-foreground">{exam.status === "published" ? "Yayında" : "Taslak"}</span>
          </button>
        ))}
        {exams.length === 0 && <p className="text-muted-foreground">Henüz sınav oluşturmadın.</p>}
      </div>
    </div>
  );
}
