import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type QuestionRow = { id: string; body: string; generationJobId: string | null };
type BatchRow = { id: string; title: string | null; createdAt: string };

function formatBatchDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CreateExamPage() {
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [approved, setApproved] = useState<QuestionRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  // null: soru havuzu kapalı. "list": havuz açık, parti listesi ("üst menü").
  // bir jobId: o partinin soru listesi açık.
  const [poolView, setPoolView] = useState<"closed" | "list" | string>("closed");

  const [createdExamId, setCreatedExamId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ questions: QuestionRow[] }>("/api/questions?status=approved")
      .then((res) => setApproved(res.questions));
    apiClient.get<{ batches: BatchRow[] }>("/api/questions/generation-batches").then((res) => setBatches(res.batches));
  }, []);

  const questionsByBatch = useMemo(() => {
    const map = new Map<string, QuestionRow[]>();
    for (const question of approved) {
      if (!question.generationJobId) continue;
      const list = map.get(question.generationJobId) ?? [];
      list.push(question);
      map.set(question.generationJobId, list);
    }
    return map;
  }, [approved]);

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

      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-accent/40 px-4 py-3">
        <p className="text-sm font-medium">{selectedQuestions.size} soru seçildi</p>
        <Button onClick={createExam} disabled={!title || selectedQuestions.size === 0}>
          Sınavı Oluştur
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => setPoolView((prev) => (prev === "closed" ? "list" : "closed"))}
      >
        {poolView === "closed" ? "Soru Havuzu" : "Soru Havuzunu Kapat"}
      </Button>

      {poolView === "list" && (
        <QuestionPoolBatchList
          batches={batches}
          questionsByBatch={questionsByBatch}
          selectedQuestions={selectedQuestions}
          onOpenBatch={(batchId) => setPoolView(batchId)}
        />
      )}

      {poolView !== "closed" && poolView !== "list" && (
        <BatchQuestionPicker
          batch={batches.find((b) => b.id === poolView)}
          questions={questionsByBatch.get(poolView) ?? []}
          selectedQuestions={selectedQuestions}
          onBack={() => setPoolView("list")}
          onCommit={(checked) => {
            setSelectedQuestions((prev) => {
              const next = new Set(prev);
              for (const question of questionsByBatch.get(poolView) ?? []) next.delete(question.id);
              for (const id of checked) next.add(id);
              return next;
            });
            setPoolView("list");
          }}
        />
      )}

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}

// Soru havuzunun "üst menüsü" — her üretim partisi ayrı bir buton, karışmasın diye.
// Eğitmen istediği kadar farklı partiye girip soru seçebiliyor, seçim burada
// (köşedeki rozet) toplamda kaç soru biriktiğini gösteriyor.
function QuestionPoolBatchList({
  batches,
  questionsByBatch,
  selectedQuestions,
  onOpenBatch,
}: {
  batches: BatchRow[];
  questionsByBatch: Map<string, QuestionRow[]>;
  selectedQuestions: Set<string>;
  onOpenBatch: (batchId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Üretilen Sorular</p>
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
          {selectedQuestions.size} seçili
        </span>
      </div>

      {batches.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Onaylanmış soru yok — önce içerik uzmanının soru üretip onaylaması gerekiyor.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {batches.map((batch) => {
          const batchQuestions = questionsByBatch.get(batch.id) ?? [];
          const selectedInBatch = batchQuestions.filter((q) => selectedQuestions.has(q.id)).length;
          return (
            <button
              key={batch.id}
              type="button"
              onClick={() => onOpenBatch(batch.id)}
              className="flex cursor-pointer items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <span className="flex flex-col">
                <span className="font-medium">{batch.title || formatBatchDate(batch.createdAt)}</span>
                <span className="text-xs text-muted-foreground">
                  {batch.title ? formatBatchDate(batch.createdAt) : null} · {batchQuestions.length} soru
                  {selectedInBatch > 0 && ` · ${selectedInBatch} seçili`}
                </span>
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                ›
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Tek bir partinin soru listesi — checkbox'lar sadece bu partiye özel (local
// state), "Sınava Ekle"ye basınca global seçime yazılıp üst menüye dönülüyor.
function BatchQuestionPicker({
  batch,
  questions,
  selectedQuestions,
  onBack,
  onCommit,
}: {
  batch: BatchRow | undefined;
  questions: QuestionRow[];
  selectedQuestions: Set<string>;
  onBack: () => void;
  onCommit: (checked: Set<string>) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(questions.filter((q) => selectedQuestions.has(q.id)).map((q) => q.id)),
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          ← Parti Listesine Dön
        </button>
        <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
          {checked.size} seçili
        </span>
      </div>

      <p className="text-sm font-semibold">{batch?.title || (batch ? formatBatchDate(batch.createdAt) : "")}</p>

      <div className="flex flex-col gap-2">
        {questions.map((question) => (
          <label key={question.id} className="flex items-start gap-2 text-left">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={checked.has(question.id)}
              onChange={() => toggle(question.id)}
            />
            <span>{question.body}</span>
          </label>
        ))}
        {questions.length === 0 && <p className="text-sm text-muted-foreground">Bu partide onaylanmış soru yok.</p>}
      </div>

      <Button type="button" onClick={() => onCommit(checked)}>
        Sınava Ekle
      </Button>
    </div>
  );
}
