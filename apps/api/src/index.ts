import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv, Bindings, DocumentProcessingMessage, QuestionGenerationMessage } from "./config/env";
import { errorHandler } from "./shared/middleware/error-handler";
import { authRoutes } from "./modules/auth/auth.routes";
import { usersRoutes } from "./modules/users/users.routes";
import { contentRoutes } from "./modules/content/content.routes";
import { questionsRoutes } from "./modules/questions/questions.routes";
import { rubricsRoutes } from "./modules/rubrics/rubrics.routes";
import { examsRoutes } from "./modules/exams/exams.routes";
import { gradingRoutes } from "./modules/grading/grading.routes";
import { reportingRoutes } from "./modules/reporting/reporting.routes";
import { processDocument } from "./modules/content/ingestion.pipeline";
import { questionsService } from "./modules/questions/questions.service";

const app = new Hono<AppEnv>();

app.use("*", cors({ credentials: true, origin: (origin) => origin }));
app.onError(errorHandler);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", authRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/content", contentRoutes);
app.route("/api/questions", questionsRoutes);
app.route("/api/rubrics", rubricsRoutes);
app.route("/api/exams", examsRoutes);
app.route("/api/grading", gradingRoutes);
app.route("/api/reporting", reportingRoutes);

export default {
  fetch: app.fetch,

  // Tek worker, iki kuyruk consume ediyor — batch.queue ile hangi kuyruktan
  // geldiğini ayırt ediyoruz (her batch tek bir kuyruktan gelir, karışık olmaz).
  async queue(batch: MessageBatch<DocumentProcessingMessage | QuestionGenerationMessage>, env: Bindings) {
    for (const message of batch.messages) {
      if (batch.queue === "rubrix-question-generation") {
        await questionsService.processGenerationJob(env, (message.body as QuestionGenerationMessage).jobId);
      } else {
        await processDocument(env, (message.body as DocumentProcessingMessage).documentId);
      }
      message.ack();
    }
  },
};
