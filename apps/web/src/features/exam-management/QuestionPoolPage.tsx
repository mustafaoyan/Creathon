import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { getSelectedQuestionIds, setSelectedQuestionIds } from "./examPoolSelection";

type QuestionRow = {
  id: string;
  body: string;
  type: "multiple_choice" | "open_ended";
  generationJobId: string | null;
};
type BatchRow = { id: string; title: string | null; createdAt: string };

const TYPE_LABELS: Record<QuestionRow["type"], string> = {
  multiple_choice: "Çoktan Seçmeli",
  open_ended: "Açık Uçlu",
};

function formatBatchDate(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ayrı bir sayfa (kullanıcı testinde bulundu — önceden Sınav Oluştur ekranına
 * gömülüydü, "Soru Havuzu"na basınca ne olduğu belirsizdi). Hem CreateExamPage'deki
 * "Soru Havuzu" butonundan hem ☰ menüden doğrudan erişilebiliyor. Seçim
 * sessionStorage'da tutuluyor (bkz. examPoolSelection.ts) — bu sayfa ile
 * /exams/new arasında gidip gelmek tam sayfa yenilemesi olduğu için. */
export function QuestionPoolPage() {
  const [approved, setApproved] = useState<QuestionRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(() => getSelectedQuestionIds());

  // null: parti listesi ("üst menü"). bir jobId: o partinin soru listesi açık.
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

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

  function persistSelection(next: Set<string>) {
    setSelectedQuestions(next);
    setSelectedQuestionIds(next);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Soru Havuzu</h1>
        <a href="/exams/new" className="text-sm font-medium text-primary underline">
          Sınava Dön
        </a>
      </div>

      {activeBatchId === null ? (
        <QuestionPoolBatchList
          batches={batches}
          questionsByBatch={questionsByBatch}
          selectedQuestions={selectedQuestions}
          onOpenBatch={setActiveBatchId}
        />
      ) : (
        <BatchQuestionPicker
          batch={batches.find((b) => b.id === activeBatchId)}
          questions={questionsByBatch.get(activeBatchId) ?? []}
          selectedQuestions={selectedQuestions}
          onBack={() => setActiveBatchId(null)}
          onCommit={(checked) => {
            const next = new Set(selectedQuestions);
            for (const question of questionsByBatch.get(activeBatchId) ?? []) next.delete(question.id);
            for (const id of checked) next.add(id);
            persistSelection(next);
            setActiveBatchId(null);
          }}
        />
      )}
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
                <span className="font-medium">{batch.title || "İsimsiz parti"}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBatchDate(batch.createdAt)} · {batchQuestions.length} soru
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
// Her sorunun yanında tipi (Çoktan Seçmeli / Açık Uçlu) gösteriliyor — önceden
// hangi sorunun hangi tipte olduğu belirsizdi (kullanıcı testinde bulundu).
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

      <div className="flex flex-col">
        <p className="text-sm font-semibold">{batch?.title || "İsimsiz parti"}</p>
        {batch && <p className="text-xs text-muted-foreground">{formatBatchDate(batch.createdAt)}</p>}
      </div>

      <div className="flex flex-col gap-2">
        {questions.map((question) => (
          <label key={question.id} className="flex items-start gap-2 text-left">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={checked.has(question.id)}
              onChange={() => toggle(question.id)}
            />
            <span className="flex flex-col gap-0.5">
              <span
                className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  question.type === "multiple_choice"
                    ? "bg-primary/15 text-primary"
                    : "bg-accent text-accent-foreground"
                }`}
              >
                {TYPE_LABELS[question.type]}
              </span>
              <span>{question.body}</span>
            </span>
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
