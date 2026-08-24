import type { SessionUser, UserRole } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LoginPage } from "@/features/auth/LoginPage";

const ROLE_HOME: Record<UserRole, { href: string; label: string }> = {
  content_creator: { href: "/content/upload", label: "İçerik Yükle" },
  instructor: { href: "/exams/new", label: "Sınav Oluştur" },
  student: { href: "/exams/take", label: "Sınavlarım" },
  admin: { href: "/dashboard", label: "Yönetici Paneli" },
};

/** Public "/" — this route has no role requirement, so it has to handle the
 * logged-out / pending-approval / active-with-role cases itself. */
export function HomePage({ user }: { user: SessionUser | null }) {
  if (!user) {
    return <LoginPage />;
  }

  if (user.status !== "active" || !user.role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">Merhaba, {user.name}</h1>
        <p className="text-muted-foreground">
          Hesabın oluşturuldu, şu an Eğitim Yöneticisinin rol ataması onayını bekliyor.
        </p>
      </div>
    );
  }

  const roleHome = ROLE_HOME[user.role];
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">Merhaba, {user.name}</h1>
      <a href={roleHome.href}>
        <Button size="lg">{roleHome.label}</Button>
      </a>
    </div>
  );
}
