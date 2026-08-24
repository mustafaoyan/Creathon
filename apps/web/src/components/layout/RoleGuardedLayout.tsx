import type { ReactNode } from "react";
import type { SessionUser, UserRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<UserRole, string> = {
  content_creator: "İçerik Uzmanı",
  instructor: "Eğitmen",
  student: "Öğrenci",
  admin: "Eğitim Yöneticisi",
};

export function RoleGuardedLayout({
  user,
  requiredRoles,
  children,
}: {
  user: SessionUser | null;
  requiredRoles: UserRole[];
  children: ReactNode;
}) {
  if (requiredRoles.length === 0) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p>Bu sayfayı görüntülemek için giriş yapmalısın.</p>
        <a href="/login">
          <Button>Giriş Yap</Button>
        </a>
      </div>
    );
  }

  const isActive = user.status === "active" && !!user.role;
  // Admin can browse every role's screens ("eğitmen gözüyle / öğrenci gözüyle") without a
  // separate login — everyone else still needs their own role in requiredRoles.
  const viewingAsAdmin = isActive && user.role === "admin" && !requiredRoles.includes("admin");
  const hasAccess = isActive && (requiredRoles.includes(user.role as UserRole) || viewingAsAdmin);

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold">Erişim yetkiniz yok</p>
        <p className="text-muted-foreground">
          {user.status === "pending"
            ? "Hesabınız yönetici onayı bekliyor."
            : "Bu sayfa için gerekli role sahip değilsiniz."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {viewingAsAdmin && (
        <div className="bg-accent px-6 py-1.5 text-xs font-medium text-accent-foreground">
          Yönetici olarak görüntülüyorsun — bu ekran normalde şu role özel:{" "}
          {requiredRoles.map((role) => ROLE_LABELS[role]).join(", ")}.
        </div>
      )}
      <header className="flex items-center justify-between border-b-2 border-primary px-6 py-3">
        <span className="flex items-center gap-2 font-bold">
          <span className="inline-block h-4 w-1.5 rounded-full bg-primary" aria-hidden="true" />
          RubriX
        </span>
        <span className="text-sm text-muted-foreground">
          {user.name} · {user.role}
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
