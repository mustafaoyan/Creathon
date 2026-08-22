import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function UploadDocumentPage() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
    setStatus(response.ok ? "Yüklendi, arka planda işleniyor." : "Yükleme başarısız.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-bold">Kaynak İçerik Yükle</h1>
      <input
        className="rounded-md border border-input px-3 py-2"
        placeholder="Başlık"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input type="file" accept=".pdf,.txt,.md" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <Button type="submit" disabled={!file || !title}>
        Yükle
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </form>
  );
}
