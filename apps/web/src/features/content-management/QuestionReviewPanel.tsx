import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type OptionRow = { id: string; label: string; body: string; isCorrect: boolean };
type QuestionRow = {
  id: string;
  body: string;
  type: string;
  status: string;
  rubricId: string | null;
  options?: OptionRow[];
};
type RubricRow = { id: string; title: string };

export function QuestionReviewPanel() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [rubrics, setRubrics] = useState<RubricRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<{ questions: QuestionRow[] }>("/api/questions?status=ai_draft")
      .then((res) => setQuestions(res.questions));
    apiClient.get<{ rubrics: RubricRow[] }>("/api/rubrics").then((res) => setRubrics(res.rubrics));
  }, []);

  async function decide(id: string, decision: "approve" | "reject") {
    setApproveError(null);
    try {
      await apiClient.post(`/api/questions/${id}/${decision}`);
      setQuestions((prev) => prev.filter((question) => question.id !== id));
    } catch {
      setApproveError("Açık uçlu bir soru rubrik seçilmeden onaylanamaz — aşağıdan bir rubrik seç.");
    }
  }

  async function attachRubric(id: string, rubricId: string) {
    await apiClient.patch(`/api/questions/${id}`, { rubricId });
    setQuestions((prev) => prev.map((question) => (question.id === id ? { ...question, rubricId } : question)));
  }

  function startEdit(question: QuestionRow) {
    setEditingId(question.id);
    setDraftBody(question.body);
  }

  async function saveEdit(id: string) {
    await apiClient.patch(`/api/questions/${id}`, { body: draftBody });
    setQuestions((prev) => prev.map((question) => (question.id === id ? { ...question, body: draftBody } : question)));
    setEditingId(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Soru Onay Paneli</h1>
      {approveError && <p className="text-sm text-destructive">{approveError}</p>}
      {questions.map((question) => (
        <div key={question.id} className="rounded-md border border-border p-4">
          {editingId === question.id ? (
            <textarea
              className="mb-2 w-full rounded-md border border-input px-3 py-2"
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
            />
          ) : (
            <p className="mb-2">{question.body}</p>
          )}

          {question.type === "multiple_choice" && question.options && (
            <ul className="mb-2 flex flex-col gap-1 text-sm">
              {question.options.map((option) => (
                <li key={option.id} className={option.isCorrect ? "font-semibold text-primary" : "text-muted-foreground"}>
                  {option.label}. {option.body} {option.isCorrect && "(doğru cevap)"}
                </li>
              ))}
            </ul>
          )}

          {question.type === "open_ended" && (
            <div className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Rubrik:</span>
              <select
                className="rounded-md border border-input px-2 py-1"
                value={question.rubricId ?? ""}
                onChange={(event) => attachRubric(question.id, event.target.value)}
              >
                <option value="" disabled>
                  Rubrik seç (zorunlu)
                </option>
                {rubrics.map((rubric) => (
                  <option key={rubric.id} value={rubric.id}>
                    {rubric.title}
                  </option>
                ))}
              </select>
              {!question.rubricId && (
                <span className="text-xs text-destructive">
                  Rubrik seçilmeden onaylanırsa öğrenci cevabı hiç değerlendirilemez.
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {editingId === question.id ? (
              <>
                <Button size="sm" onClick={() => saveEdit(question.id)}>
                  Kaydet
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Vazgeç
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  disabled={question.type === "open_ended" && !question.rubricId}
                  onClick={() => decide(question.id, "approve")}
                >
                  Onayla
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(question.id, "reject")}>
                  Reddet
                </Button>
                <Button size="sm" variant="outline" onClick={() => startEdit(question)}>
                  Düzenle
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      {questions.length === 0 && <p className="text-muted-foreground">Bekleyen soru yok.</p>}
    </div>
  );
}
