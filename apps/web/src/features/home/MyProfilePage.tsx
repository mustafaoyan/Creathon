import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { fetchCurrentUser, type SessionUser, type UserRole } from "@/lib/auth-client";

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

  useEffect(() => {
    fetchCurrentUser().then((res) => setUser(res.user));
  }, []);

  useEffect(() => {
    if (user?.role !== "student") return;
    apiClient.get<{ assignments: ExamHistoryRow[] }>("/api/exams/my").then((res) => setExamHistory(res.assignments));
  }, [user?.role]);

  if (!user) return <p className="text-muted-foreground">Yükleniyor...</p>;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <h1 className="text-xl font-bold">Bilgilerim</h1>

      <div className="flex flex-col gap-2 rounded-md border border-border p-4 text-left">
        <InfoRow label="Ad Soyad" value={user.name} />
        <InfoRow label="E-posta" value={user.email} />
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
