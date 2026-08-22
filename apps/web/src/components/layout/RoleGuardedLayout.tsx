import type { ReactNode } from "react";
import type { SessionUser, UserRole } from "@/lib/auth-client";
import { getGoogleLoginUrl } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

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
        <a href={getGoogleLoginUrl()}>
          <Button>Google ile Giriş Yap</Button>
        </a>
      </div>
    );
  }

  if (user.status !== "active" || !user.role || !requiredRoles.includes(user.role)) {
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
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="font-bold">RubriX</span>
        <span className="text-sm text-muted-foreground">
          {user.name} · {user.role}
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
