import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type OptionRow = { id: string; label: string; body: string; isCorrect: boolean };
type QuestionRow = { id: string; body: string; type: string; status: string; options?: OptionRow[] };

export function QuestionReviewPanel() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");

  useEffect(() => {
    apiClient
      .get<{ questions: QuestionRow[] }>("/api/questions?status=ai_draft")
      .then((res) => setQuestions(res.questions));
  }, []);

  async function decide(id: string, decision: "approve" | "reject") {
    await apiClient.post(`/api/questions/${id}/${decision}`);
    setQuestions((prev) => prev.filter((question) => question.id !== id));
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
                <Button size="sm" onClick={() => decide(question.id, "approve")}>
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
