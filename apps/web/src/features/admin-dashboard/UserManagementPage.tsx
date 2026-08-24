import { useEffect, useState } from "react";
import { USER_ROLES, type UserRole, type UserStatus } from "@rubrix/shared-types";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  requestedRole: UserRole | null;
  status: UserStatus;
};

const ROLE_LABELS: Record<UserRole, string> = {
  content_creator: "İçerik Uzmanı",
  instructor: "Eğitmen",
  student: "Öğrenci",
  admin: "Eğitim Yöneticisi",
};

export function UserManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);

  useEffect(() => {
    apiClient.get<{ users: UserRow[] }>("/api/users").then((res) => setUsers(res.users));
  }, []);

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
      <div className="flex flex-col gap-2">
        {users.map((user) => (
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
      </div>
    </div>
  );
}
