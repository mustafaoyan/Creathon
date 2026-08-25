import { useEffect, useState } from "react";
import { USER_ROLES, type UserRole, type UserStatus } from "@rubrix/shared-types";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  requestedRole: UserRole | null;
  status: UserStatus;
};

type GatedRole = "content_creator" | "instructor";
type AllowlistEntry = { id: string; email: string; role: GatedRole; createdAt: string };

const ROLE_LABELS: Record<UserRole, string> = {
  content_creator: "İçerik Uzmanı",
  instructor: "Eğitmen",
  student: "Öğrenci",
  admin: "Eğitim Yöneticisi",
};

const GATED_ROLE_LABELS: Record<GatedRole, string> = {
  content_creator: "İçerik Uzmanı",
  instructor: "Eğitmen",
};

export function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");

  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<GatedRole>("instructor");

  useEffect(() => {
    apiClient.get<{ users: UserRow[] }>("/api/users").then((res) => setUsers(res.users));
    refreshAllowlist();
  }, []);

  function refreshAllowlist() {
    apiClient.get<{ entries: AllowlistEntry[] }>("/api/users/role-allowlist").then((res) => setAllowlist(res.entries));
  }

  async function addToAllowlist() {
    if (!newEmail.trim()) return;
    await apiClient.post("/api/users/role-allowlist", { email: newEmail.trim(), role: newRole });
    setNewEmail("");
    refreshAllowlist();
    toast.success(`${newEmail.trim()} — ${GATED_ROLE_LABELS[newRole]} için izinli e-posta listesine eklendi.`);
  }

  async function removeFromAllowlist(id: string) {
    await apiClient.delete(`/api/users/role-allowlist/${id}`);
    setAllowlist((prev) => prev.filter((entry) => entry.id !== id));
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("tr");
  const filteredUsers = normalizedQuery
    ? users.filter((user) => {
        const roleLabel = user.role ? ROLE_LABELS[user.role] : "";
        return [user.name, user.email, roleLabel, user.status]
          .join(" ")
          .toLocaleLowerCase("tr")
          .includes(normalizedQuery);
      })
    : users;

  async function changeRole(id: string, role: UserRole) {
    const { user } = await apiClient.patch<{ user: UserRow }>(`/api/users/${id}/role`, { role });
    setUsers((prev) => prev.map((row) => (row.id === id ? user : row)));
  }

  async function suspend(id: string) {
    await apiClient.post(`/api/users/${id}/suspend`);
    setUsers((prev) => prev.map((row) => (row.id === id ? { ...row, status: "suspended" } : row)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Kullanıcı Yönetimi</h1>
        <a href="/dashboard" className="text-sm font-medium text-primary underline">
          Panele Dön
        </a>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <div>
          <h2 className="text-sm font-semibold">Eğitmen / İçerik Uzmanı İzin Listesi</h2>
          <p className="text-xs text-muted-foreground">
            Bu roller artık herkese açık self-servis değil — sadece burada listelenen e-posta
            adresleri, ilgili giriş kartına tıkladığında o role anında sahip olabiliyor. Listede
            olmayan biri girerse hesabı "onay bekliyor" durumunda oluşur.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-input px-3 py-2 text-sm"
            placeholder="ornek@gmail.com"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
          />
          <select
            className="rounded-md border border-input px-2 py-2 text-sm"
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as GatedRole)}
          >
            {(Object.keys(GATED_ROLE_LABELS) as GatedRole[]).map((role) => (
              <option key={role} value={role}>
                {GATED_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={!newEmail.trim()} onClick={addToAllowlist}>
            Ekle
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          {allowlist.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-md bg-secondary/40 px-3 py-1.5 text-sm">
              <span>
                {entry.email} <span className="text-muted-foreground">— {GATED_ROLE_LABELS[entry.role]}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => removeFromAllowlist(entry.id)}>
                Kaldır
              </Button>
            </div>
          ))}
          {allowlist.length === 0 && <p className="text-xs text-muted-foreground">İzin listesi boş.</p>}
        </div>
      </div>

      <input
        className="rounded-md border border-input px-3 py-2"
        placeholder="İsim, e-posta, rol veya duruma göre ara..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex flex-col gap-2">
        {filteredUsers.map((user) => (
          <div key={user.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">
                {user.email} · {user.status}
              </p>
              {user.requestedRole && !user.role && (
                <p className="text-sm text-primary">İstenen rol: {ROLE_LABELS[user.requestedRole]}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                className="rounded-md border border-input px-2 py-1"
                value={user.role ?? ""}
                onChange={(event) => changeRole(user.id, event.target.value as UserRole)}
              >
                <option value="" disabled>
                  Rol seç
                </option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              {user.status !== "suspended" && (
                <Button size="sm" variant="outline" onClick={() => suspend(user.id)}>
                  Askıya Al
                </Button>
              )}
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-muted-foreground">Kullanıcı yok.</p>}
        {users.length > 0 && filteredUsers.length === 0 && (
          <p className="text-muted-foreground">Aramayla eşleşen kullanıcı yok.</p>
        )}
      </div>
    </div>
  );
}
