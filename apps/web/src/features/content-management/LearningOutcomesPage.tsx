import { useEffect, useState, type FormEvent } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type DocumentRow = { id: string; title: string; status: string };
type OutcomeRow = {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  level: "temel" | "orta" | "ileri" | null;
  documentId: string | null;
};

const LEVELS: { value: OutcomeRow["level"]; label: string }[] = [
  { value: "temel", label: "Temel" },
  { value: "orta", label: "Orta" },
  { value: "ileri", label: "İleri" },
];

export function LearningOutcomesPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<string>("temel");
  const [documentId, setDocumentId] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<{ documents: DocumentRow[] }>("/api/content/documents").then((res) => setDocuments(res.documents));
    refreshOutcomes();
  }, []);

  function refreshOutcomes() {
    apiClient
      .get<{ learningOutcomes: OutcomeRow[] }>("/api/content/learning-outcomes")
      .then((res) => setOutcomes(res.learningOutcomes));
  }

  async function createOutcome(event: FormEvent) {
    event.preventDefault();
    setStatus("Kaydediliyor...");
    await apiClient.post("/api/content/learning-outcomes", {
      title,
      description: description || undefined,
      topic: topic || undefined,
      level,
      documentId: documentId || undefined,
    });
    setTitle("");
    setDescription("");
    setTopic("");
    setStatus("Kazanım eklendi.");
    refreshOutcomes();
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Kazanım Tanımla</h1>
          <div className="flex gap-4 text-sm font-medium">
            <a href="/content/upload" className="text-primary underline">
              İçerik Yükle
            </a>
            <a href="/content/generate" className="text-primary underline">
              Soru Üret
            </a>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Kaynak içerikle ilişkili öğrenme kazanımlarını burada tanımlarsın — soru üretimi bu kazanıma göre yapılır.
        </p>
      </div>

      <form onSubmit={createOutcome} className="flex flex-col gap-3">
        <select
          className="rounded-md border border-input px-3 py-2"
          value={documentId}
          onChange={(event) => setDocumentId(event.target.value)}
        >
          <option value="">Kaynak seçilmedi (genel kazanım)</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title} ({doc.status})
            </option>
          ))}
        </select>

        <input
          className="rounded-md border border-input px-3 py-2"
          placeholder="Kazanım (örn. Fotosentez sürecini açıklayabilir)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />

        <textarea
          className="rounded-md border border-input px-3 py-2"
          placeholder="Açıklama (opsiyonel)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="flex gap-3">
          <input
            className="flex-1 rounded-md border border-input px-3 py-2"
            placeholder="Konu (örn. Biyoloji - Hücre)"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          />
          <select
            className="rounded-md border border-input px-3 py-2"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            {LEVELS.map((option) => (
              <option key={option.value} value={option.value ?? ""}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" disabled={!title}>
          Kazanımı Kaydet
        </Button>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
      </form>

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
