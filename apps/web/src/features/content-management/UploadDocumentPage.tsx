import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

// Backend'deki gerçek sınırlarla senkron tut (bkz. content.routes.ts) — sadece
// bilgilendirme amaçlı, gerçek zorlama sunucu tarafında.
const MAX_FILE_SIZE_MB = 20;

type DocumentRow = { id: string; title: string; status: string };
type OutcomeRow = {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  level: "temel" | "orta" | "ileri" | null;
  documentId: string | null;
};

const LEVELS: { value: NonNullable<OutcomeRow["level"]>; label: string }[] = [
  { value: "temel", label: "Temel" },
  { value: "orta", label: "Orta" },
  { value: "ileri", label: "İleri" },
];

/** Kazanım tanımlama artık ayrı bir sayfa değil, doğrudan içerik yükleme
 * ekranının bir parçası — belge yüklendikten sonra o belgeye ait kazanımı
 * hemen burada tanımlayabiliyorsun, ayrı bir ekrana gitmene gerek yok. Soru
 * üretme ekranı da artık kaynak seçilince bu kazanımları otomatik gösteriyor
 * (bkz. GenerateQuestionsPage.tsx) — kazanımı tekrar elle aramana gerek yok. */
export function UploadDocumentPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [outcomeDocumentId, setOutcomeDocumentId] = useState("");
  const [outcomeTitle, setOutcomeTitle] = useState("");
  const [outcomeDescription, setOutcomeDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<string>("temel");
  const [outcomeStatus, setOutcomeStatus] = useState<string | null>(null);

  useEffect(() => {
    refreshDocuments();
    refreshOutcomes();
  }, []);

  function refreshDocuments() {
    apiClient.get<{ documents: DocumentRow[] }>("/api/content/documents").then((res) => setDocuments(res.documents));
  }

  function refreshOutcomes() {
    apiClient
      .get<{ learningOutcomes: OutcomeRow[] }>("/api/content/learning-outcomes")
      .then((res) => setOutcomes(res.learningOutcomes));
  }

  function handleFileChange(selected: File | null) {
    if (selected && selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploadStatus(`Dosya çok büyük — en fazla ${MAX_FILE_SIZE_MB} MB olabilir.`);
      setFile(null);
      return;
    }
    setUploadStatus(null);
    setFile(selected);
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file || !title) return;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    setUploadStatus("Yükleniyor...");
    const response = await fetch("/api/content/documents", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (response.ok) {
      const { id } = (await response.json()) as { id: string };
      setUploadStatus("Yüklendi, arka planda işleniyor.");
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setOutcomeDocumentId(id); // az sonra tanımlanacak kazanım otomatik bu belgeye bağlansın
      refreshDocuments();
    } else {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setUploadStatus(
        body.error === "file_too_large"
          ? `Dosya çok büyük — en fazla ${MAX_FILE_SIZE_MB} MB olabilir.`
          : "Yükleme başarısız.",
      );
    }
  }

  async function createOutcome(event: FormEvent) {
    event.preventDefault();
    setOutcomeStatus("Kaydediliyor...");
    await apiClient.post("/api/content/learning-outcomes", {
      title: outcomeTitle,
      description: outcomeDescription || undefined,
      topic: topic || undefined,
      level,
      documentId: outcomeDocumentId || undefined,
    });
    setOutcomeTitle("");
    setOutcomeDescription("");
    setTopic("");
    setOutcomeStatus("Kazanım eklendi.");
    refreshOutcomes();
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kaynak İçerik Yükle</h1>
        <a href="/content/generate" className="text-sm font-medium text-primary underline">
          Soru Üret
        </a>
      </div>

      <form onSubmit={handleUpload} className="flex flex-col gap-3">
        <input
          className="rounded-md border border-input px-3 py-2"
          placeholder="Başlık"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-input p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="hidden"
            onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Dosya Seç
          </Button>
          <p className="text-sm text-muted-foreground">{file ? file.name : "Dosya seçilmedi"}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Desteklenen dosya türleri: PDF, TXT, MD · Maksimum dosya boyutu: {MAX_FILE_SIZE_MB} MB
        </p>

        <Button type="submit" disabled={!file || !title}>
          Yükle
        </Button>
        {uploadStatus && <p className="text-sm text-muted-foreground">{uploadStatus}</p>}
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Kazanım Tanımla</h2>
          <p className="text-sm text-muted-foreground">
            Kaynak içerikle ilişkili öğrenme kazanımlarını burada tanımlarsın — soru üretimi bu kazanıma göre yapılır.
          </p>
        </div>

        <form onSubmit={createOutcome} className="flex flex-col gap-3">
          <select
            className="rounded-md border border-input px-3 py-2"
            value={outcomeDocumentId}
            onChange={(event) => setOutcomeDocumentId(event.target.value)}
          >
            <option value="">Kaynak seçilmedi (genel kazanım)</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title}
              </option>
            ))}
          </select>

          <input
            className="rounded-md border border-input px-3 py-2"
            placeholder="Kazanım"
            value={outcomeTitle}
            onChange={(event) => setOutcomeTitle(event.target.value)}
            required
          />

          <div className="flex flex-col gap-1">
            <span className="flex items-baseline gap-1.5 text-sm font-medium">
              Açıklama <span className="text-xs font-normal text-muted-foreground">(opsiyonel)</span>
            </span>
            <textarea
              className="rounded-md border border-input px-3 py-2"
              value={outcomeDescription}
              onChange={(event) => setOutcomeDescription(event.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <input
              className="flex-1 rounded-md border border-input px-3 py-2"
              placeholder="Konu"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
            <select
              className="rounded-md border border-input px-3 py-2"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
            >
              {LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" disabled={!outcomeTitle}>
            Kazanımı Kaydet
          </Button>
          {outcomeStatus && <p className="text-sm text-muted-foreground">{outcomeStatus}</p>}
        </form>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Tanımlı Kazanımlar</h2>
        <div className="flex flex-col gap-2">
          {outcomes.map((outcome) => (
            <div key={outcome.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{outcome.title}</p>
              <p className="text-muted-foreground">
                {outcome.topic ? `${outcome.topic} · ` : ""}
                {LEVELS.find((option) => option.value === outcome.level)?.label ?? "Seviye belirtilmedi"}
              </p>
            </div>
          ))}
          {outcomes.length === 0 && <p className="text-muted-foreground">Henüz kazanım yok.</p>}
        </div>
      </div>
    </div>
  );
}
