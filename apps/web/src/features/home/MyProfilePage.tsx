import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { fetchCurrentUser, type SessionUser, type UserRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

const ROLE_LABELS: Record<UserRole, string> = {
  content_creator: "İçerik Uzmanı",
  instructor: "Eğitmen",
  student: "Öğrenci",
  admin: "Eğitim Yöneticisi",
};

const STATUS_LABELS: Record<string, string> = {
  assigned: "Atandı",
  in_progress: "Devam ediyor",
  submitted: "Gönderildi — açık uçlu sorular değerlendiriliyor",
  graded: "Değerlendirildi",
};

type ExamHistoryRow = { id: string; title: string; status: string; totalScore: number | null };

/** MVP zorunluluğu değil — sade bir "kimim, hangi roldeyim, (öğrenciysem)
 * bana ne atanmış" özeti. Sınıf/grup alanı şemada henüz yok, o yüzden burada
 * gösterilmiyor (var olmayan bir veriyi uydurmak yerine sessizce atlanıyor). */
export function MyProfilePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [examHistory, setExamHistory] = useState<ExamHistoryRow[] | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  // "view": sadece göster. "editEmail": yeni adres gir + kod gönder.
  // "editCode": kutuya gelen kodu gir + onayla.
  const [emailStep, setEmailStep] = useState<"view" | "editEmail" | "editCode">("view");
  const [newEmailDraft, setNewEmailDraft] = useState("");
  const [codeDraft, setCodeDraft] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser().then((res) => setUser(res.user));
  }, []);

  function startEditingName() {
    if (!user) return;
    setNameDraft(user.name);
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await apiClient.patch("/api/users/me", { name: trimmed });
      toast.success("Ad Soyad güncellendi.");
      // Sidebar/üst başlık ayrı bir React ağacında sunucudan gelen initialUser'ı
      // kullanıyor — hepsinde tutarlı görünmesi için sayfayı yeniliyoruz.
      window.location.reload();
    } catch {
      toast.error("Ad Soyad güncellenemedi, tekrar dene.");
      setSavingName(false);
    }
  }

  const EMAIL_ERROR_LABELS: Record<string, string> = {
    invalid_email: "Geçerli bir e-posta adresi gir.",
    email_unchanged: "Bu zaten mevcut e-posta adresin.",
    email_already_in_use: "Bu e-posta adresi başka bir hesapta kayıtlı.",
    too_many_requests: "Az önce bir kod gönderildi — birkaç saniye bekleyip tekrar dene.",
    invalid_code: "Kod yanlış.",
    code_expired: "Kodun süresi doldu, tekrar kod iste.",
    no_pending_email_change: "Bekleyen bir istek bulunamadı, baştan başla.",
  };

  async function requestEmailCode() {
    setEmailError(null);
    setEmailBusy(true);
    try {
      await apiClient.post("/api/users/me/email/request-change", { newEmail: newEmailDraft.trim() });
      toast.success(`${newEmailDraft.trim()} adresine bir doğrulama kodu gönderildi.`);
      setCodeDraft("");
      setEmailStep("editCode");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setEmailError(EMAIL_ERROR_LABELS[message] ?? "Kod gönderilemedi, tekrar dene.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmEmailCode() {
    setEmailError(null);
    setEmailBusy(true);
    try {
      await apiClient.post("/api/users/me/email/confirm-change", { code: codeDraft.trim() });
      toast.success("E-posta adresin güncellendi.");
      // Ad Soyad'daki gibi — Sidebar/üst başlık ayrı bir yerde sunucudan gelen
      // initialUser'ı kullanıyor, tutarlı görünmesi için sayfa yenileniyor.
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setEmailError(EMAIL_ERROR_LABELS[message] ?? "Doğrulanamadı, tekrar dene.");
      setEmailBusy(false);
    }
  }

  function cancelEmailChange() {
    setEmailStep("view");
    setNewEmailDraft("");
    setCodeDraft("");
    setEmailError(null);
  }

  useEffect(() => {
    if (user?.role !== "student") return;
    apiClient.get<{ assignments: ExamHistoryRow[] }>("/api/exams/my").then((res) => setExamHistory(res.assignments));
  }, [user?.role]);

  if (!user) return <p className="text-muted-foreground">Yükleniyor...</p>;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-xl font-bold">Bilgilerim</h1>

      <div className="flex flex-col gap-2 rounded-md border border-border p-4 text-left">
        {editingName ? (
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Ad Soyad</span>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="rounded-md border border-input px-2 py-1 text-sm"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveName();
                  if (event.key === "Escape") setEditingName(false);
                }}
                disabled={savingName}
              />
              <Button className="h-7 px-2 text-xs" onClick={saveName} disabled={savingName || !nameDraft.trim()}>
                {savingName ? "Kaydediliyor..." : "Kaydet"}
              </Button>
              <button
                type="button"
                className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setEditingName(false)}
                disabled={savingName}
              >
                İptal
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Ad Soyad</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{user.name}</span>
              <button
                type="button"
                className="cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
                onClick={startEditingName}
              >
                Düzenle
              </button>
            </span>
          </div>
        )}
        {emailStep === "view" && (
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">E-posta</span>
            <span className="flex items-center gap-2">
              <span className="font-medium">{user.email}</span>
              <button
                type="button"
                className="cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setEmailStep("editEmail")}
              >
                Değiştir
              </button>
            </span>
          </div>
        )}

        {emailStep === "editEmail" && (
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">Yeni e-posta</span>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="email"
                placeholder="ornek@eposta.com"
                className="flex-1 rounded-md border border-input px-2 py-1 text-sm"
                value={newEmailDraft}
                onChange={(event) => setNewEmailDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && requestEmailCode()}
                disabled={emailBusy}
              />
              <Button className="h-7 px-2 text-xs" onClick={requestEmailCode} disabled={emailBusy || !newEmailDraft.trim()}>
                {emailBusy ? "Gönderiliyor..." : "Kod Gönder"}
              </Button>
              <button
                type="button"
                className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={cancelEmailChange}
                disabled={emailBusy}
              >
                İptal
              </button>
            </div>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
        )}

        {emailStep === "editCode" && (
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-muted-foreground">
              <strong className="font-medium text-foreground">{newEmailDraft.trim()}</strong> adresine gönderilen kod
            </span>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                inputMode="numeric"
                placeholder="6 haneli kod"
                className="flex-1 rounded-md border border-input px-2 py-1 text-sm"
                value={codeDraft}
                onChange={(event) => setCodeDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && confirmEmailCode()}
                disabled={emailBusy}
              />
              <Button className="h-7 px-2 text-xs" onClick={confirmEmailCode} disabled={emailBusy || !codeDraft.trim()}>
                {emailBusy ? "Doğrulanıyor..." : "Onayla"}
              </Button>
              <button
                type="button"
                className="cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={cancelEmailChange}
                disabled={emailBusy}
              >
                İptal
              </button>
            </div>
            <button
              type="button"
              className="w-fit cursor-pointer text-xs text-primary underline-offset-2 hover:underline"
              onClick={requestEmailCode}
              disabled={emailBusy}
            >
              Kodu Tekrar Gönder
            </button>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>
        )}

        <InfoRow label="Rol" value={user.role ? ROLE_LABELS[user.role] : "—"} />
      </div>

      {user.role === "student" && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Atanmış Sınavlarım</h2>
          <div className="flex flex-col gap-1.5">
            {(examHistory ?? []).map((exam) => (
              <div key={exam.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{exam.title}</span>
                <span className="text-muted-foreground">
                  {STATUS_LABELS[exam.status] ?? exam.status}
                  {exam.totalScore !== null && ` · ${exam.totalScore.toFixed(1)} puan`}
                </span>
              </div>
            ))}
            {examHistory?.length === 0 && <p className="text-sm text-muted-foreground">Henüz atanmış sınav yok.</p>}
            {examHistory === null && <p className="text-sm text-muted-foreground">Yükleniyor...</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
