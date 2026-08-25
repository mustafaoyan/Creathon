import { eq, desc, and } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import { users, roleAllowlist, type UserRole, type RoleAllowlistRole } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const usersRepository = {
  async findByGoogleId(db: Database, googleId: string) {
    const [row] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return row ?? null;
  },

  async findById(db: Database, id: string) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  },

  async createFromGoogle(
    db: Database,
    profile: {
      googleId: string;
      email: string;
      name: string;
      avatarUrl?: string | null;
      requestedRole?: UserRole | null;
    },
  ) {
    const id = newId("user");
    const now = new Date();
    // student ve admin tamamen açık self-servis (admin ayrıca ADMIN_INVITE_CODE
    // ile korunuyor, bkz. auth.routes.ts — o kontrol Google'a yönlendirmeden ÖNCE
    // yapılıyor). content_creator/instructor ise SADECE admin'in role_allowlist'e
    // eklediği e-postalarla self-servis — aksi halde eğitmen/içerik uzmanı
    // rollerine herkes tek tıkla kaydolabiliyordu, bu bir güvenlik açığıydı.
    const requestedRole = profile.requestedRole;
    const isOpenSelfServiceRole = requestedRole === "student" || requestedRole === "admin";
    const gatedRole = requestedRole === "content_creator" || requestedRole === "instructor" ? requestedRole : null;

    let isSelfServiceRole = isOpenSelfServiceRole;
    if (gatedRole) {
      const [allowed] = await db
        .select({ id: roleAllowlist.id })
        .from(roleAllowlist)
        .where(and(eq(roleAllowlist.email, normalizeEmail(profile.email)), eq(roleAllowlist.role, gatedRole)))
        .limit(1);
      isSelfServiceRole = !!allowed;
    }

    await db.insert(users).values({
      id,
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl ?? null,
      role: isSelfServiceRole ? profile.requestedRole : null,
      requestedRole: profile.requestedRole ?? null,
      status: isSelfServiceRole ? "active" : "pending",
      createdAt: now,
      updatedAt: now,
    });
    return usersRepository.findById(db, id);
  },

  list(db: Database) {
    return db.select().from(users).orderBy(desc(users.createdAt));
  },

  /** Narrow, non-admin-only lookup — e.g. an instructor picking students to assign an exam to. */
  listByRole(db: Database, role: UserRole) {
    return db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, role), eq(users.status, "active")))
      .orderBy(users.name);
  },

  async assignRole(db: Database, id: string, role: UserRole) {
    await db.update(users).set({ role, status: "active", updatedAt: new Date() }).where(eq(users.id, id));
    return usersRepository.findById(db, id);
  },

  async suspend(db: Database, id: string) {
    await db.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, id));
  },

  async updateAvatarUrl(db: Database, id: string, avatarUrl: string) {
    await db.update(users).set({ avatarUrl, updatedAt: new Date() }).where(eq(users.id, id));
  },

  async updateName(db: Database, id: string, name: string) {
    await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, id));
    return usersRepository.findById(db, id);
  },
};

export const roleAllowlistRepository = {
  list(db: Database) {
    return db
      .select({
        id: roleAllowlist.id,
        email: roleAllowlist.email,
        role: roleAllowlist.role,
        createdAt: roleAllowlist.createdAt,
      })
      .from(roleAllowlist)
      .orderBy(desc(roleAllowlist.createdAt));
  },

  async add(db: Database, data: { email: string; role: RoleAllowlistRole; createdBy: string }) {
    const id = newId("invite");
    await db
      .insert(roleAllowlist)
      .values({ id, email: normalizeEmail(data.email), role: data.role, createdBy: data.createdBy, createdAt: new Date() })
      .onConflictDoNothing();
    return id;
  },

  async remove(db: Database, id: string) {
    await db.delete(roleAllowlist).where(eq(roleAllowlist.id, id));
  },
};
