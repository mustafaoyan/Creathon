import { eq, desc } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import { rubrics, rubricCriteria } from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";

export const rubricsRepository = {
  async create(
    db: Database,
    data: {
      title: string;
      maxScore: number;
      createdBy: string;
      criteria: { criterion: string; description?: string | null; weight: number }[];
    },
  ) {
    const id = newId("rubric");
    await db.insert(rubrics).values({
      id,
      title: data.title,
      maxScore: data.maxScore,
      createdBy: data.createdBy,
      createdAt: new Date(),
    });

    if (data.criteria.length > 0) {
      await db.insert(rubricCriteria).values(
        data.criteria.map((criterion, index) => ({
          id: newId("criterion"),
          rubricId: id,
          criterion: criterion.criterion,
          description: criterion.description ?? null,
          weight: criterion.weight,
          orderIndex: index,
        })),
      );
    }

    return id;
  },

  list(db: Database) {
    return db.select().from(rubrics).orderBy(desc(rubrics.createdAt));
  },

  async findById(db: Database, id: string) {
    const [row] = await db.select().from(rubrics).where(eq(rubrics.id, id)).limit(1);
    return row ?? null;
  },

  criteriaFor(db: Database, rubricId: string) {
    return db.select().from(rubricCriteria).where(eq(rubricCriteria.rubricId, rubricId));
  },
};
