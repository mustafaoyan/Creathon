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
  bare,
  children,
}: {
  user: SessionUser | null;
  requiredRoles: UserRole[];
  /** true: içerik varsayılan koyu "kart" kutusuna sarılmadan doğrudan uzay
   * arka planının üstünde render edilir (ör. karşılama ekranı). */
  bare?: boolean;
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

  return (
    <AuthenticatedLayout user={user} viewingAsAdmin={viewingAsAdmin} requiredRoles={requiredRoles} bare={bare}>
      {children}
    </AuthenticatedLayout>
  );
}

function AuthenticatedLayout({
  user,
  viewingAsAdmin,
  requiredRoles,
  bare,
  children,
}: {
  user: SessionUser;
  viewingAsAdmin: boolean;
  requiredRoles: UserRole[];
  bare?: boolean;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Önceki denemeler (min-h-screen + belgenin kendisini kaydırmak, overscroll-behavior
  // ile taşmayı engellemek) hâlâ bazı ekranlarda siyah bir alanla sonuçlanıyordu — çünkü
  // arka planı taşıyan div'lerin GERÇEK yüksekliği içerik + iç içe flex zincirine bağlıydı,
  // birebir viewport'u garanti etmiyordu. Artık kökten farklı bir yaklaşım: bu iki dış
  // div KESİN OLARAK `h-screen` (viewport'un TAMAMI, ne eksik ne fazla) ve `overflow-hidden`
  // — belge asla kaymıyor, arka plan asla "kısa kalmıyor". İçerik uzunsa sadece EN İÇTEKİ
  // içerik sarmalayıcısı (`overflow-y-auto`) kendi içinde kayıyor; nav ve sidebar zaten
  // `fixed` olduğu için bundan etkilenmiyor.
  return (
    <div
      className="h-screen overflow-hidden bg-fixed bg-cover bg-center"
      style={{ backgroundImage: `url("${SPACE_BG_URL}")` }}
    >
      <div className={`rbx-space-alive flex h-screen flex-col bg-gradient-to-b from-[#050b24]/85 via-[#0b1f4d]/80 to-[#123a7a]/75 ${NAV_HEIGHT_CLASS}`}>
        <TeknofestNav action={{ label: "ÇIKIŞ YAP", onClick: handleLogout }} />
        {/* Sidebar'ın kendi menü açma düğmesi (☰) nav'ın hemen altına sabit
            konumlanıyor — admin başka bir role "gözünden" bakarken görünen
            uyarı şeridi de nav'ın hemen altına normal akışta ekleniyor, bu
            yüzden ☰ düğmesi o şeridin ÜSTÜNE biniyordu (kullanıcı testinde
            bulundu). Sidebar'a şeridin var olup olmadığını bildirip düğmeyi
            buna göre aşağı kaydırıyoruz. */}
        <Sidebar user={user} open={sidebarOpen} onOpenChange={setSidebarOpen} bannerOffset={viewingAsAdmin} />
        {/* w-[calc(100%-16rem)] kasıtlı: ml-64 tek başına, zaten flex-1 ile
            %100 genişliğe sahip bir kutuyu konteynerin dışına taşırıyordu —
            sayfa yatayda kayıyor, sağda kaydırma sırasında arka plansız
            (siyah) bir boşluk açığa çıkıyordu (bildirilen bug tam buydu). */}
        <div
          className={`flex flex-1 flex-col overflow-y-auto transition-all duration-300 ${sidebarOpen ? "ml-64 w-[calc(100%-16rem)]" : "ml-0 w-full"}`}
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
            {bare ? (
              children
            ) : (
              <div className="mx-auto max-w-5xl rounded-lg bg-background p-6 shadow-2xl ring-1 ring-primary/10">
                {children}
              </div>
            )}
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
    <div className="h-screen overflow-hidden bg-fixed bg-cover bg-center" style={{ backgroundImage: `url("${SPACE_BG_URL}")` }}>
      <div className={`rbx-space-alive flex h-screen flex-col bg-gradient-to-b from-[#050b24]/85 via-[#0b1f4d]/80 to-[#123a7a]/75 ${NAV_HEIGHT_CLASS}`}>
        <TeknofestNav action={action} />
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
