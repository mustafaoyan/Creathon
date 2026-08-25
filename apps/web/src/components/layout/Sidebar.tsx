import { useRef, useState, type ChangeEvent } from "react";
import type { SessionUser, UserRole } from "@/lib/auth-client";
import { logout } from "@/lib/auth-client";

const ROLE_LINKS: Record<UserRole, { href: string; label: string }[]> = {
  content_creator: [
    { href: "/content/upload", label: "İçerik Yükle" },
    { href: "/content/outcomes", label: "Kazanım Tanımla" },
    { href: "/content/generate", label: "Soru Üret" },
    { href: "/content/review", label: "Soru Onay Paneli" },
  ],
  instructor: [
    { href: "/exams/new", label: "Sınav Oluştur" },
    { href: "/exams/grading", label: "Puanlama Onayı" },
  ],
  student: [{ href: "/exams/take", label: "Sınavlarım" }],
  admin: [
    { href: "/dashboard", label: "Panel" },
    { href: "/admin/users", label: "Kullanıcı Yönetimi" },
  ],
};

async function handleLogout() {
  await logout();
  window.location.href = "/login";
}

export function Sidebar({
  user,
  open,
  onOpenChange,
}: {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const links = user.role ? ROLE_LINKS[user.role] : [];
  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setAvatarStatus("Yükleniyor...");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/users/me/avatar", { method: "POST", body: formData, credentials: "include" });

    if (response.ok) {
      const { user: updated } = (await response.json()) as { user: { avatarUrl: string | null } };
      setAvatarUrl(updated.avatarUrl);
      setAvatarStatus(null);
    } else {
      setAvatarStatus("Yükleme başarısız — lütfen bir resim dosyası seç.");
    }
  }

  return (
    <>
      <aside
        className={`fixed bottom-0 left-0 top-16 z-40 flex flex-col overflow-hidden border-r border-white/10 bg-[#0b1330]/95 text-white backdrop-blur transition-[width] duration-300 ${
          open ? "w-64" : "w-0"
        }`}
      >
        <div className="flex w-64 justify-end px-3 pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Menüyü kapat"
            className="cursor-pointer rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            ☰
          </button>
        </div>

        <div className="flex w-64 flex-col items-center gap-2 px-4 pb-6 pt-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user.name}
              className="h-16 w-16 rounded-full border-2 border-primary object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-white/10 text-xl font-bold">
              {initial}
            </div>
          )}
          <p className="text-sm font-semibold">{user.name}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer text-xs text-white/60 underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            Profil Resmini Değiştir
          </button>
          {avatarStatus && <p className="text-center text-[11px] text-white/50">{avatarStatus}</p>}
        </div>

        <nav className="flex w-64 flex-1 flex-col gap-1 px-3">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <button
          type="button"
          onClick={handleLogout}
          className="w-64 cursor-pointer border-t border-white/10 px-4 py-3 text-left text-sm font-semibold text-white/70 transition-colors hover:bg-destructive/20 hover:text-destructive"
        >
          Çıkış Yap
        </button>
      </aside>

      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Menüyü aç"
          className="fixed left-4 top-20 z-40 cursor-pointer rounded-md bg-[#0b1330]/90 p-2.5 text-white shadow-lg transition-colors hover:bg-[#0b1330]"
        >
          ☰
        </button>
      )}
    </>
  );
}
