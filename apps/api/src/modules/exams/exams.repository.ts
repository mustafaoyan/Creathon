import { eq, and, desc } from "drizzle-orm";
import type { Database } from "../../shared/db/client";
import {
  exams,
  examQuestions,
  examAssignments,
  examAttempts,
  studentAnswers,
  questions,
  questionOptions,
  type AssignmentStatus,
} from "../../shared/db/schema";
import { newId } from "../../shared/lib/id";

export const examsRepository = {
  async create(db: Database, data: { title: string; createdBy: string; durationMinutes: number | null }) {
    const id = newId("exam");
    await db.insert(exams).values({
      id,
      title: data.title,
      createdBy: data.createdBy,
      durationMinutes: data.durationMinutes,
      status: "draft",
      createdAt: new Date(),
    });
    return id;
  },

  async findById(db: Database, id: string) {
    const [row] = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
    return row ?? null;
  },

  list(db: Database) {
    return db.select().from(exams).orderBy(desc(exams.createdAt));
  },

  async addQuestions(db: Database, examId: string, items: { questionId: string; points: number }[]) {
    await db.insert(examQuestions).values(
      items.map((item, index) => ({
        id: newId("examq"),
        examId,
        questionId: item.questionId,
        orderIndex: index,
        points: item.points,
      })),
    );
  },

  questionsFor(db: Database, examId: string) {
    return db
      .select({
        id: examQuestions.id,
        questionId: examQuestions.questionId,
        orderIndex: examQuestions.orderIndex,
        points: examQuestions.points,
        type: questions.type,
        body: questions.body,
      })
      .from(examQuestions)
      .innerJoin(questions, eq(questions.id, examQuestions.questionId))
      .where(eq(examQuestions.examId, examId))
      .orderBy(examQuestions.orderIndex);
  },

  async publish(db: Database, examId: string) {
    await db.update(exams).set({ status: "published" }).where(eq(exams.id, examId));
  },

  async assignStudents(db: Database, examId: string, studentIds: string[]) {
    await db.insert(examAssignments).values(
      studentIds.map((studentId) => ({
        id: newId("assign"),
        examId,
        studentId,
        status: "assigned" as const,
        assignedAt: new Date(),
      })),
    );
  },

  assignmentsForStudent(db: Database, studentId: string) {
    return db
      .select({
        id: examAssignments.id,
        examId: examAssignments.examId,
        status: examAssignments.status,
        title: exams.title,
      })
      .from(examAssignments)
      .innerJoin(exams, eq(exams.id, examAssignments.examId))
      .where(eq(examAssignments.studentId, studentId));
  },

  async findAssignment(db: Database, examId: string, studentId: string) {
    const [row] = await db
      .select()
      .from(examAssignments)
      .where(and(eq(examAssignments.examId, examId), eq(examAssignments.studentId, studentId)))
      .limit(1);
    return row ?? null;
  },

  async findAssignmentById(db: Database, id: string) {
    const [row] = await db.select().from(examAssignments).where(eq(examAssignments.id, id)).limit(1);
    return row ?? null;
  },

  async setAssignmentStatus(db: Database, id: string, status: AssignmentStatus) {
    await db.update(examAssignments).set({ status }).where(eq(examAssignments.id, id));
  },

  async createAttempt(db: Database, examAssignmentId: string) {
    const id = newId("attempt");
    await db.insert(examAttempts).values({ id, examAssignmentId, startedAt: new Date() });
    return id;
  },

  async findAttemptById(db: Database, id: string) {
    const [row] = await db.select().from(examAttempts).where(eq(examAttempts.id, id)).limit(1);
    return row ?? null;
  },

  async findAttemptByAssignment(db: Database, examAssignmentId: string) {
    const [row] = await db
      .select()
      .from(examAttempts)
      .where(eq(examAttempts.examAssignmentId, examAssignmentId))
      .limit(1);
    return row ?? null;
  },

  async upsertAnswer(
    db: Database,
    data: { attemptId: string; questionId: string; selectedOptionId?: string | null; answerText?: string | null },
  ) {
    await db
      .insert(studentAnswers)
      .values({
        id: newId("answer"),
        attemptId: data.attemptId,
        questionId: data.questionId,
        selectedOptionId: data.selectedOptionId ?? null,
        answerText: data.answerText ?? null,
        answeredAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [studentAnswers.attemptId, studentAnswers.questionId],
        set: {
          selectedOptionId: data.selectedOptionId ?? null,
          answerText: data.answerText ?? null,
          answeredAt: new Date(),
        },
      });
  },

  answersForAttempt(db: Database, attemptId: string) {
    return db.select().from(studentAnswers).where(eq(studentAnswers.attemptId, attemptId));
  },

  async findAnswerById(db: Database, id: string) {
    const [row] = await db.select().from(studentAnswers).where(eq(studentAnswers.id, id)).limit(1);
    return row ?? null;
  },

  async markSubmitted(db: Database, attemptId: string, partialTotalScore: number) {
    await db
      .update(examAttempts)
      .set({ submittedAt: new Date(), totalScore: partialTotalScore })
      .where(eq(examAttempts.id, attemptId));
  },

  async updateAttemptTotal(db: Database, attemptId: string, totalScore: number) {
    await db.update(examAttempts).set({ totalScore }).where(eq(examAttempts.id, attemptId));
  },

  correctOptionFor(db: Database, questionId: string) {
    return db
      .select()
      .from(questionOptions)
      .where(and(eq(questionOptions.questionId, questionId), eq(questionOptions.isCorrect, true)));
  },
};
