import { eq, desc, and } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import { users, type UserRole } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";

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
    await db.insert(users).values({
      id,
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl ?? null,
      role: null,
      requestedRole: profile.requestedRole ?? null,
      status: "pending",
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
};
