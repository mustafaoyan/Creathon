import { useState } from "react";
import { getGoogleLoginUrl } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type Role = "instructor" | "student";

const ROLE_COPY: Record<Role, { title: string; description: string }> = {
  instructor: {
    title: "Eğitmen Girişi",
    description: "Sınav oluştur, soru havuzunu onayla, AI puanlamalarını değerlendir.",
  },
  student: {
    title: "Öğrenci Girişi",
    description: "Sana atanan sınavlara gir, sonuçlarını takip et.",
  },
};

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-12">
      <div className="flex flex-col items-center gap-2">
        <span className="inline-block h-1.5 w-16 rounded-full bg-primary" />
        <h1 className="text-3xl font-bold">RubriX</h1>
        <p className="text-muted-foreground">
          Yapay Zekâ Destekli Ölçme ve Değerlendirme Sistemi — TEKNOFEST T3 Vakfı
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        <RoleLoginCard role="instructor" />
        <RoleLoginCard role="student" />
      </div>
    </div>
  );
}

function RoleLoginCard({ role }: { role: Role }) {
  const [showT3Notice, setShowT3Notice] = useState(false);
  const copy = ROLE_COPY[role];

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-border bg-secondary/40 p-6">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <a href={getGoogleLoginUrl(role)} className="w-full">
          <Button className="w-full">Google ile Giriş Yap</Button>
        </a>
        <Button variant="outline" className="w-full" onClick={() => setShowT3Notice(true)}>
          T3 Hesabıyla Giriş Yap
        </Button>
      </div>

      {showT3Notice && (
        <p className="text-xs text-muted-foreground">
          T3 hesabıyla giriş yakında aktif olacak. Şimdilik Google ile devam edebilirsin.
        </p>
      )}
    </div>
  );
}
