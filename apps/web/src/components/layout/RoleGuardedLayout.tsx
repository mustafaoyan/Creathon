import { useState, type ReactNode } from "react";
import type { SessionUser, UserRole } from "@/lib/auth-client";
import { logout } from "@/lib/auth-client";
import { TeknofestNav, SPACE_BG_URL, NAV_HEIGHT_CLASS } from "@/components/layout/TeknofestNav";
import { Sidebar } from "@/components/layout/Sidebar";

const ROLE_LABELS: Record<UserRole, string> = {
  content_creator: "İçerik Uzmanı",
  instructor: "Eğitmen",
  student: "Öğrenci",
  admin: "Eğitim Yöneticisi",
};

async function handleLogout() {
  await logout();
  window.location.href = "/login";
}

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
      <Backdrop action={{ label: "GİRİŞ YAP 🚀", href: "/login" }}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-white">
          <p>Bu sayfayı görüntülemek için giriş yapmalısın.</p>
          <a
            href="/login"
            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
          >
            Giriş Yap
          </a>
        </div>
      </Backdrop>
    );
  }

  const isActive = user.status === "active" && !!user.role;
  // Admin can browse every role's screens ("eğitmen gözüyle / öğrenci gözüyle") without a
  // separate login — everyone else still needs their own role in requiredRoles.
  const viewingAsAdmin = isActive && user.role === "admin" && !requiredRoles.includes("admin");
  const hasAccess = isActive && (requiredRoles.includes(user.role as UserRole) || viewingAsAdmin);

  if (!hasAccess) {
    return (
      <Backdrop action={{ label: "ÇIKIŞ YAP", onClick: handleLogout }}>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-white">
          <p className="text-lg font-semibold">Erişim yetkiniz yok</p>
          <p className="text-white/70">
            {user.status === "pending"
              ? "Hesabınız yönetici onayı bekliyor."
              : "Bu sayfa için gerekli role sahip değilsiniz."}
          </p>
        </div>
      </Backdrop>
    );
  }

  return <AuthenticatedLayout user={user} viewingAsAdmin={viewingAsAdmin} requiredRoles={requiredRoles}>{children}</AuthenticatedLayout>;
}

function AuthenticatedLayout({
  user,
  viewingAsAdmin,
  requiredRoles,
  children,
}: {
  user: SessionUser;
  viewingAsAdmin: boolean;
  requiredRoles: UserRole[];
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div
      className="flex min-h-screen flex-col bg-fixed bg-cover bg-center"
      style={{ backgroundImage: `url("${SPACE_BG_URL}")` }}
    >
      <div className={`rbx-space-alive flex min-h-screen flex-1 flex-col bg-gradient-to-b from-[#050b24]/85 via-[#0b1f4d]/80 to-[#123a7a]/75 ${NAV_HEIGHT_CLASS}`}>
        <TeknofestNav action={{ label: "ÇIKIŞ YAP", onClick: handleLogout }} />
        <Sidebar user={user} open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div
          className={`flex flex-1 flex-col transition-[margin] duration-300 ${sidebarOpen ? "ml-64" : "ml-0"}`}
        >
          {viewingAsAdmin && (
            <div className="bg-accent px-6 py-1.5 text-xs font-medium text-accent-foreground">
              Yönetici olarak görüntülüyorsun — bu ekran normalde şu role özel:{" "}
              {requiredRoles.map((role) => ROLE_LABELS[role]).join(", ")}.
            </div>
          )}
          <div className="px-6 pt-3 text-right text-sm text-white/80">
            {user.name} · {ROLE_LABELS[user.role as UserRole]}
          </div>
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-5xl rounded-lg bg-background p-6 shadow-2xl ring-1 ring-primary/10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Backdrop({
  action,
  children,
}: {
  action: { label: string; onClick?: () => void; href?: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-fixed bg-cover bg-center" style={{ backgroundImage: `url("${SPACE_BG_URL}")` }}>
      <div className={`rbx-space-alive flex min-h-screen flex-1 flex-col bg-gradient-to-b from-[#050b24]/85 via-[#0b1f4d]/80 to-[#123a7a]/75 ${NAV_HEIGHT_CLASS}`}>
        <TeknofestNav action={action} />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
