import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type DocumentRow = { id: string; title: string; status: string };
type OutcomeRow = { id: string; title: string; documentId: string | null };
type RubricRow = { id: string; title: string; maxScore: number };

type GenerationJobStatus = "queued" | "processing" | "completed" | "failed";
type GenerationJob = {
  id: string;
  status: GenerationJobStatus;
  questionCount: number;
  questionsGenerated: number;
  failureReason: string | null;
  createdAt: string;
};

const JOB_STATUS_LABELS: Record<GenerationJobStatus, string> = {
  queued: "Sıraya alındı",
  processing: "Üretiliyor",
  completed: "Tamamlandı",
  failed: "Başarısız",
};

/** Üretim artık kuyrukta arka planda çalışıyor — bu sayfadan ayrılıp geri
 * dönsen ya da sekmeyi kapatsan da iş devam ediyor. Bu yüzden job'ı polling
 * ile takip ediyoruz (istek boyunca tarayıcıyı bloklamak yerine) ve sayfa
 * mount olduğunda kullanıcının en son işini otomatik bulup gösteriyoruz —
 * "önceki işlem nereye gitti" sorusunun cevabı burada. */
export function GenerateQuestionsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [rubrics, setRubrics] = useState<RubricRow[]>([]);

  const [documentId, setDocumentId] = useState("");
  const [learningOutcomeId, setLearningOutcomeId] = useState("");
  const [rubricId, setRubricId] = useState("");
  const [multipleChoiceCount, setMultipleChoiceCount] = useState(3);
  const [openEndedCount, setOpenEndedCount] = useState(2);
  const [showNewRubric, setShowNewRubric] = useState(false);

  const [job, setJob] = useState<GenerationJob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const jobInFlight = job?.status === "queued" || job?.status === "processing";

  useEffect(() => {
    refreshAll();
    apiClient.get<{ job: GenerationJob | null }>("/api/questions/generate-status/latest").then((res) => {
      if (res.job) setJob(res.job);
    });
  }, []);

  useEffect(() => {
    if (!jobInFlight || !job) return;

    // job.createdAt (sunucu zamanı) baz alınıyor — sayfa ne zaman açılırsa
    // açılsın geçen süre doğru gösterilir; sayfa açılış anını baz alsaydık
    // her yeniden açılışta sayaç sıfırlanırdı (bildirilen bug tam buydu).
    const createdAtMs = new Date(job.createdAt).getTime();
    const tick = () => setElapsedSeconds(Math.round((Date.now() - createdAtMs) / 1000));
    tick();
    const tickTimer = setInterval(tick, 1000);

    const poll = window.setInterval(async () => {
      const updated = await apiClient.get<GenerationJob>(`/api/questions/generate/${job.id}`);
      setJob(updated);
      if (updated.status === "completed" || updated.status === "failed") {
        if (pollRef.current) window.clearInterval(pollRef.current);
      }
    }, 2000);
    pollRef.current = poll;

    return () => {
      clearInterval(tickTimer);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, jobInFlight]);

  async function cancelJob() {
    if (!job) return;
    await apiClient.post(`/api/questions/generate/${job.id}/cancel`);
    setJob((prev) => (prev ? { ...prev, status: "failed", failureReason: "kullanici_tarafindan_iptal_edildi" } : prev));
  }

  function refreshAll() {
    apiClient.get<{ documents: DocumentRow[] }>("/api/content/documents").then((res) => setDocuments(res.documents));
    apiClient
      .get<{ learningOutcomes: OutcomeRow[] }>("/api/content/learning-outcomes")
      .then((res) => setOutcomes(res.learningOutcomes));
    apiClient.get<{ rubrics: RubricRow[] }>("/api/rubrics").then((res) => setRubrics(res.rubrics));
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    if (!documentId || !learningOutcomeId) return;

    setError(null);
    try {
      const { generationJobId } = await apiClient.post<{ generationJobId: string }>("/api/questions/generate", {
        documentId,
        learningOutcomeId,
        rubricId: rubricId || undefined,
        multipleChoiceCount,
        openEndedCount,
      });
      setJob({
        id: generationJobId,
        status: "queued",
        questionCount: multipleChoiceCount + openEndedCount,
        questionsGenerated: 0,
        failureReason: null,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.startsWith("too_many_questions_requested")
          ? "Tek seferde en fazla 10 soru üretilebilir (çoktan seçmeli + açık uçlu toplamı) — büyük istekler zaman aşımına uğrayıp hiç bitmeyebiliyor."
          : "Soru üretimi başlatılamadı.",
      );
    }
  }

  const readyDocuments = documents.filter((doc) => doc.status === "ready");

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">AI ile Soru Üret</h1>
        <a href="/content/review" className="text-sm font-medium text-primary underline">
          Soru Onay Paneli
        </a>
      </div>

      <form onSubmit={generate} className="flex flex-col gap-3">
        <select
          className="rounded-md border border-input px-3 py-2"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
          required
        >
          <option value="" disabled>
            Kaynak belge seç
          </option>
          {readyDocuments.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title}
            </option>
          ))}
        </select>
        {documents.length > 0 && readyDocuments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Yüklediğin belgeler henüz işleniyor — hazır olunca burada seçilebilir olacak.
          </p>
        )}

        <select
          className="rounded-md border border-input px-3 py-2"
          value={learningOutcomeId}
          onChange={(event) => setLearningOutcomeId(event.target.value)}
          required
        >
          <option value="" disabled>
            Kazanım seç
          </option>
          {outcomes.map((outcome) => (
            <option key={outcome.id} value={outcome.id}>
              {outcome.title}
            </option>
          ))}
        </select>

        <div className="flex items-end gap-3">
          <select
            className="flex-1 rounded-md border border-input px-3 py-2"
            value={rubricId}
            onChange={(event) => setRubricId(event.target.value)}
          >
            <option value="">Rubrik yok (sadece çoktan seçmeli için sorun olmaz)</option>
            {rubrics.map((rubric) => (
              <option key={rubric.id} value={rubric.id}>
                {rubric.title}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => setShowNewRubric((prev) => !prev)}>
            {showNewRubric ? "Vazgeç" : "Yeni Rubrik"}
          </Button>
        </div>

        {showNewRubric && (
          <RubricQuickCreate
            onCreated={(id) => {
              setRubricId(id);
              setShowNewRubric(false);
              refreshAll();
            }}
          />
        )}

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Çoktan seçmeli adedi
            <input
              type="number"
              min={0}
              max={10}
              className="rounded-md border border-input px-3 py-2"
              value={multipleChoiceCount}
              onChange={(event) => setMultipleChoiceCount(Number(event.target.value))}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Açık uçlu adedi
            <input
              type="number"
              min={0}
              max={10}
              className="rounded-md border border-input px-3 py-2"
              value={openEndedCount}
              onChange={(event) => setOpenEndedCount(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Tek seferde toplam en fazla 10 soru üretilebilir.</p>

        <Button type="submit" disabled={!documentId || !learningOutcomeId || jobInFlight}>
          {jobInFlight ? "Üretiliyor..." : "Soru Üret"}
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {job && <GenerationJobStatusCard job={job} elapsedSeconds={elapsedSeconds} onCancel={cancelJob} />}
    </div>
  );
}

const FAILURE_REASON_LABELS: Record<string, string> = {
  kullanici_tarafindan_iptal_edildi: "Kullanıcı tarafından iptal edildi.",
  zaman_asimi_iptal_edildi: "İşlem çok uzun sürdü ve otomatik olarak durduruldu — daha az soru ile tekrar dene.",
  no_grounded_chunks_found_for_outcome: "Kaynak belgede bu kazanımla eşleşen bir bölüm bulunamadı.",
};

function GenerationJobStatusCard({
  job,
  elapsedSeconds,
  onCancel,
}: {
  job: GenerationJob;
  elapsedSeconds: number;
  onCancel: () => void;
}) {
  const inFlight = job.status === "queued" || job.status === "processing";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        {inFlight && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary"
          />
        )}
        <p className="text-sm font-semibold">{JOB_STATUS_LABELS[job.status]}</p>
        {inFlight && <p className="text-xs text-muted-foreground">({elapsedSeconds}sn geçti)</p>}
      </div>

      {inFlight && (
        <>
          <p className="text-xs text-muted-foreground">
            Bu işlem arka planda (kuyrukta) çalışıyor — sayfadan ayrılsan veya sekmeyi kapatsan da devam eder, geri
            döndüğünde son durumunu burada görürsün. Normalde 1-2 dakika içinde biter; 3 dakikayı geçerse otomatik
            olarak başarısız işaretlenir.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onCancel} className="w-fit">
            İşlemi İptal Et
          </Button>
        </>
      )}

      {job.status === "completed" && (
        <p className="text-sm text-muted-foreground">
          {job.questionsGenerated} soru üretildi —{" "}
          <a href="/content/review" className="font-medium text-primary underline">
            onaylamak için Soru Onay Paneli'ne git
          </a>
          .
        </p>
      )}

      {job.status === "failed" && (
        <p className="text-sm text-destructive">
          Üretim başarısız oldu:{" "}
          {(job.failureReason && FAILURE_REASON_LABELS[job.failureReason]) || job.failureReason || "bilinmeyen hata"}
        </p>
      )}
    </div>
  );
}

const EMPTY_CRITERIA = [
  { criterion: "Kavramsal doğruluk", weight: 0.6 },
  { criterion: "Açıklık ve ifade", weight: 0.4 },
];

function RubricQuickCreate({ onCreated }: { onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState(EMPTY_CRITERIA);
  const [error, setError] = useState<string | null>(null);

  const weightSum = criteria.reduce((sum, c) => sum + c.weight, 0);

  function updateCriterion(index: number, field: "criterion" | "weight", value: string) {
    setCriteria((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: field === "weight" ? Number(value) : value } : c)),
    );
  }

  function addRow() {
    setCriteria((prev) => [...prev, { criterion: "", weight: 0 }]);
  }

  async function submit() {
    setError(null);
    try {
      const { id } = await apiClient.post<{ id: string }>("/api/rubrics", { title, maxScore: 100, criteria });
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rubrik oluşturulamadı.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <input
        className="rounded-md border border-input px-3 py-2"
        placeholder="Rubrik başlığı (örn. Açık Uçlu Değerlendirme Rubriği)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      {criteria.map((criterion, index) => (
        <div key={index} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-input px-3 py-2"
            placeholder="Kriter"
            value={criterion.criterion}
            onChange={(event) => updateCriterion(index, "criterion", event.target.value)}
          />
          <input
            type="number"
            step="0.1"
            min={0}
            max={1}
            className="w-24 rounded-md border border-input px-3 py-2"
            value={criterion.weight}
            onChange={(event) => updateCriterion(index, "weight", event.target.value)}
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={addRow}>
        + Kriter Ekle
      </Button>
      <p className={`text-xs ${Math.abs(weightSum - 1) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}>
        Ağırlık toplamı: {weightSum.toFixed(2)} (1.00 olmalı)
      </p>
      <Button type="button" size="sm" disabled={!title || Math.abs(weightSum - 1) > 0.01} onClick={submit}>
        Rubriği Kaydet
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
