import type { Bindings } from "../../config/env";
import { createDb } from "../../shared/db/client";
import { rubricsRepository } from "./rubrics.repository";
import { HttpError } from "../../shared/middleware/error-handler";

const WEIGHT_SUM_TOLERANCE = 0.01;

export const rubricsService = {
  async create(
    env: Bindings,
    data: {
      title: string;
      maxScore: number;
      createdBy: string;
      criteria: { criterion: string; description?: string; weight: number }[];
    },
  ) {
    if (data.criteria.length === 0) throw new HttpError(422, "at_least_one_criterion_required");

    const totalWeight = data.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
    if (Math.abs(totalWeight - 1) > WEIGHT_SUM_TOLERANCE) {
      throw new HttpError(422, "criteria_weights_must_sum_to_1");
    }

    return rubricsRepository.create(createDb(env.DB), data);
  },

  list(env: Bindings) {
    return rubricsRepository.list(createDb(env.DB));
  },

  async getWithCriteria(env: Bindings, id: string) {
    const db = createDb(env.DB);
    const rubric = await rubricsRepository.findById(db, id);
    if (!rubric) throw new HttpError(404, "rubric_not_found");
    const criteria = await rubricsRepository.criteriaFor(db, id);
    return { ...rubric, criteria };
  },
};
