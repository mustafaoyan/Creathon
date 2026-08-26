import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { getSelectedQuestionIds, clearSelectedQuestionIds } from "./examPoolSelection";

function parseEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function CreateExamPage() {
  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [selectedCount, setSelectedCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  // Boş = herkese açık (varsayılan). Doldurulursa sadece bu e-postalar
  // sınavı görüp girebilir — "belirlemediği kişiler sisteme girip soruları
  // çözemesin" (kullanıcı isteği).
  const [showAllowlist, setShowAllowlist] = useState(false);
  const [allowlistRaw, setAllowlistRaw] = useState("");
  const allowedEmails = parseEmails(allowlistRaw);

  const [createdExamId, setCreatedExamId] = useState<string | null>(null);
  const [wasRestricted, setWasRestricted] = useState(false);
  const [published, setPublished] = useState(false);

  // Soru Havuzu artık ayrı bir sayfa (/exams/pool) — buraya dönünce (tam sayfa
  // yenilemeyle) seçim sayısını sessionStorage'dan okuyoruz, bkz. examPoolSelection.ts.
  useEffect(() => {
    setSelectedCount(getSelectedQuestionIds().size);
  }, []);

  async function createExam() {
    setStatus("Oluşturuluyor...");
    const { id } = await apiClient.post<{ id: string }>("/api/exams", {
      title,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
      questionIds: Array.from(getSelectedQuestionIds()).map((questionId) => ({ questionId, points: 10 })),
      allowedEmails: allowedEmails.length > 0 ? allowedEmails : undefined,
    });
    clearSelectedQuestionIds();
    setWasRestricted(allowedEmails.length > 0);
    setCreatedExamId(id);
    setStatus(null);
  }

  async function publish() {
    if (!createdExamId) return;
    await apiClient.post(`/api/exams/${createdExamId}/publish`);
    setPublished(true);
    toast.success(
      wasRestricted ? "Sınav yayınlandı — sadece eklediğin öğrenciler görebilir." : "Sınav yayınlandı — tüm öğrenciler artık görebilir.",
    );
  }

  if (createdExamId) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <h1 className="text-xl font-bold">Sınavı Yayınla</h1>
        <p className="text-sm text-muted-foreground">
          Sınav oluşturuldu (taslak). Yayınladığında{" "}
          {wasRestricted ? "sadece eklediğin öğrenciler" : "öğrenci olarak giren herkes"} "Sınavlarım" listesinde
          görüp girebilecek.
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

      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <button
          type="button"
          onClick={() => setShowAllowlist((prev) => !prev)}
          className="flex cursor-pointer items-center justify-between text-left text-sm font-medium"
        >
          <span>Katılımcıları Sınırla (opsiyonel)</span>
          <span className="text-xs text-muted-foreground">
            {allowedEmails.length > 0 ? `${allowedEmails.length} kişi eklendi` : "herkese açık"}
          </span>
        </button>
        {showAllowlist && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              Buraya e-posta eklersen sınavı SADECE bu adresler görüp girebilir — boş bırakırsan öğrenci olarak
              giren herkes görebilir (varsayılan). Her satıra bir e-posta, ya da virgülle ayır.
            </p>
            <textarea
              className="rounded-md border border-input px-3 py-2 text-sm"
              placeholder={"ogrenci1@ornek.com\nogrenci2@ornek.com"}
              rows={4}
              value={allowlistRaw}
              onChange={(event) => setAllowlistRaw(event.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-accent/40 px-4 py-3">
        <p className="text-sm font-medium">{selectedCount} soru seçildi</p>
        <Button onClick={createExam} disabled={!title || selectedCount === 0}>
          Sınavı Oluştur
        </Button>
      </div>

      <a href="/exams/pool">
        <Button type="button" variant="outline" className="w-full">
          Soru Havuzu
        </Button>
      </a>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </div>
  );
}
