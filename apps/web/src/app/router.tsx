import type { ComponentType } from "react";
import type { UserRole } from "@/lib/auth-client";
import { LoginPage } from "@/features/auth/LoginPage";
import { WelcomePage } from "@/features/home/WelcomePage";
import { MyProfilePage } from "@/features/home/MyProfilePage";
import { UploadDocumentPage } from "@/features/content-management/UploadDocumentPage";
import { LearningOutcomesPage } from "@/features/content-management/LearningOutcomesPage";
import { GenerateQuestionsPage } from "@/features/content-management/GenerateQuestionsPage";
import { QuestionReviewPanel } from "@/features/content-management/QuestionReviewPanel";
import { CreateExamPage } from "@/features/exam-management/CreateExamPage";
import { GradingReviewPage } from "@/features/exam-management/GradingReviewPage";
import { ExamRunnerPage } from "@/features/exam-taking/ExamRunnerPage";
import { DashboardPage } from "@/features/admin-dashboard/DashboardPage";
import { UserManagementPage } from "@/features/admin-dashboard/UserManagementPage";

export type AppRoute = {
  path: string;
  component: ComponentType;
  /** Empty = public route (no auth/role check). */
  roles: UserRole[];
  /** true: içerik varsayılan koyu kart kutusuna sarılmadan doğrudan uzay
   * arka planının üstünde render edilir (bkz. RoleGuardedLayout). */
  bare?: boolean;
};

const ALL_ROLES: UserRole[] = ["content_creator", "instructor", "student", "admin"];

export const ROUTES: AppRoute[] = [
  { path: "/login", component: LoginPage, roles: [] },
  { path: "/welcome", component: WelcomePage, roles: ALL_ROLES, bare: true },
  { path: "/profile", component: MyProfilePage, roles: ALL_ROLES },
  { path: "/content/upload", component: UploadDocumentPage, roles: ["content_creator"] },
  { path: "/content/outcomes", component: LearningOutcomesPage, roles: ["content_creator"] },
  { path: "/content/generate", component: GenerateQuestionsPage, roles: ["content_creator"] },
  { path: "/content/review", component: QuestionReviewPanel, roles: ["content_creator"] },
  { path: "/exams/new", component: CreateExamPage, roles: ["instructor"] },
  { path: "/exams/grading", component: GradingReviewPage, roles: ["instructor"] },
  { path: "/exams/take", component: ExamRunnerPage, roles: ["student"] },
  { path: "/dashboard", component: DashboardPage, roles: ["admin"] },
  { path: "/admin", component: DashboardPage, roles: ["admin"] },
  { path: "/admin/users", component: UserManagementPage, roles: ["admin"] },
];

export function resolveRoute(pathname: string): AppRoute | null {
  return ROUTES.find((route) => route.path === pathname) ?? null;
}
