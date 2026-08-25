import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

// Backend'deki gerçek sınırlarla senkron tut (bkz. content.routes.ts) — sadece
// bilgilendirme amaçlı, gerçek zorlama sunucu tarafında.
const MAX_FILE_SIZE_MB = 20;

export function UploadDocumentPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function handleFileChange(selected: File | null) {
    if (selected && selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setStatus(`Dosya çok büyük — en fazla ${MAX_FILE_SIZE_MB} MB olabilir.`);
      setFile(null);
      return;
    }
    setStatus(null);
    setFile(selected);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !title) return;

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    setStatus("Yükleniyor...");
    const response = await fetch("/api/content/documents", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (response.ok) {
      setStatus("Yüklendi, arka planda işleniyor.");
    } else {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus(
        body.error === "file_too_large"
          ? `Dosya çok büyük — en fazla ${MAX_FILE_SIZE_MB} MB olabilir.`
          : "Yükleme başarısız.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kaynak İçerik Yükle</h1>
        <a href="/content/outcomes" className="text-sm font-medium text-primary underline">
          Kazanım Tanımla
        </a>
      </div>
      <input
        className="rounded-md border border-input px-3 py-2"
        placeholder="Başlık"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        type="file"
        accept=".pdf,.txt,.md"
        onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
      />
      <p className="text-xs text-muted-foreground">
        Desteklenen dosya türleri: PDF, TXT, MD • Maksimum dosya boyutu: {MAX_FILE_SIZE_MB} MB
      </p>
      <Button type="submit" disabled={!file || !title}>
        Yükle
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </form>
  );
}
