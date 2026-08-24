import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { usersRepository } from "./users.repository";
import type { UserRole } from "../../shared/db/schema";
import { HttpError } from "../../shared/middleware/error-handler";

export const usersService = {
  list(env: Bindings) {
    return usersRepository.list(createDb(env.DB));
  },

  listStudents(env: Bindings) {
    return usersRepository.listByRole(createDb(env.DB), "student");
  },

  async assignRole(env: Bindings, userId: string, role: UserRole) {
    const db = createDb(env.DB);
    const user = await usersRepository.findById(db, userId);
    if (!user) throw new HttpError(404, "user_not_found");
    return usersRepository.assignRole(db, userId, role);
  },

  async suspend(env: Bindings, userId: string) {
    const db = createDb(env.DB);
    const user = await usersRepository.findById(db, userId);
    if (!user) throw new HttpError(404, "user_not_found");
    await usersRepository.suspend(db, userId);
  },
};
