import type { ComponentType } from "react";
import type { UserRole } from "@/lib/auth-client";
import { LoginPage } from "@/features/auth/LoginPage";
import { UploadDocumentPage } from "@/features/content-management/UploadDocumentPage";
import { QuestionReviewPanel } from "@/features/content-management/QuestionReviewPanel";
import { CreateExamPage } from "@/features/exam-management/CreateExamPage";
import { GradingReviewPage } from "@/features/exam-management/GradingReviewPage";
import { ExamRunnerPage } from "@/features/exam-taking/ExamRunnerPage";
import { DashboardPage } from "@/features/admin-dashboard/DashboardPage";

export type AppRoute = {
  path: string;
  component: ComponentType;
  /** Empty = public route (no auth/role check). */
  roles: UserRole[];
};

export const ROUTES: AppRoute[] = [
  { path: "/login", component: LoginPage, roles: [] },
  { path: "/content/upload", component: UploadDocumentPage, roles: ["content_creator"] },
  { path: "/content/review", component: QuestionReviewPanel, roles: ["content_creator", "instructor"] },
  { path: "/exams/new", component: CreateExamPage, roles: ["instructor"] },
  { path: "/exams/grading", component: GradingReviewPage, roles: ["instructor"] },
  { path: "/exams/take", component: ExamRunnerPage, roles: ["student"] },
  { path: "/dashboard", component: DashboardPage, roles: ["admin"] },
];

export function resolveRoute(pathname: string): AppRoute | null {
  return ROUTES.find((route) => route.path === pathname) ?? null;
}
