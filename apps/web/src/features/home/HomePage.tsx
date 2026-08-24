import type { SessionUser } from "@/lib/auth-client";
import { LoginPage } from "@/features/auth/LoginPage";

/** Public "/" — an active user with a role never actually renders this: the
 * worker redirects them straight to their role's home (see worker/index.tsx).
 * This only ever handles logged-out and pending-approval visitors. */
export function HomePage({ user }: { user: SessionUser | null }) {
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-xl font-semibold">Merhaba, {user.name}</h1>
      <p className="text-muted-foreground">
        Hesabın oluşturuldu, şu an Eğitim Yöneticisinin rol ataması onayını bekliyor.
      </p>
    </div>
  );
}
