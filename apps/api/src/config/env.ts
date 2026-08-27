export type Bindings = {
  // Data
  DB: D1Database;
  BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  DOC_QUEUE: Queue<DocumentProcessingMessage>;
  QUESTION_GEN_QUEUE: Queue<QuestionGenerationMessage>;

  // Config / secrets (wrangler vars + `wrangler secret put`)
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_COOKIE_SECURE: string; // "true" | "false" — "false" only for local http dev
  ADMIN_INVITE_CODE: string; // login ekranında "Eğitim Yöneticisi Girişi" bu kodu isteyip karşılaştırıyor
  ANTHROPIC_API_KEY: string;
  CF_ACCOUNT_ID: string;
  CF_AI_GATEWAY_ID: string;
  AI_PROVIDER: string; // "anthropic" | "openai" — resolved by ai.factory.ts
  RESEND_API_KEY: string; // e-posta değişikliği doğrulama kodu göndermek için (bkz. shared/lib/email.ts)
  EMAIL_FROM: string; // ör. "RubriX <noreply@hititai.com>"
  JURY_LOGIN_PEPPER: string; // jüri demo girişindeki şifre hash'ini doğrulamak için (bkz. auth.service.ts#juryLogin)
};

export type DocumentProcessingMessage = {
  documentId: string;
};

export type QuestionGenerationMessage = {
  jobId: string;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    userId: string;
    userRole: string | null;
  };
};
