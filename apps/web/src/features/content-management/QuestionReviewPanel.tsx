import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type QuestionRow = { id: string; body: string; type: string; status: string };

export function QuestionReviewPanel() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  useEffect(() => {
    apiClient
      .get<{ questions: QuestionRow[] }>("/api/questions?status=ai_draft")
      .then((res) => setQuestions(res.questions));
  }, []);

  async function decide(id: string, decision: "approve" | "reject") {
    await apiClient.post(`/api/questions/${id}/${decision}`);
    setQuestions((prev) => prev.filter((question) => question.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Soru Onay Paneli</h1>
      {questions.map((question) => (
        <div key={question.id} className="rounded-md border border-border p-4">
          <p className="mb-2">{question.body}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => decide(question.id, "approve")}>
              Onayla
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide(question.id, "reject")}>
              Reddet
            </Button>
          </div>
        </div>
      ))}
      {questions.length === 0 && <p className="text-muted-foreground">Bekleyen soru yok.</p>}
    </div>
  );
}
