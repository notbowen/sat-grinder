import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: text("role").default("user"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
}, (table) => [uniqueIndex("idx_user_username").on(table.username)]);

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
}, (table) => [index("idx_session_user_id").on(table.userId)]);

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (table) => [
  uniqueIndex("idx_account_issuer_account").on(table.issuer, table.accountId),
  index("idx_account_user_id").on(table.userId),
]);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
}, (table) => [index("idx_verification_identifier").on(table.identifier)]);

export type AnswerOption = { letter: string; content: string };

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  triggeredBy: text("triggered_by").references(() => user.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  totalMetadata: integer("total_metadata").notNull().default(0),
  fetchedDetails: integer("fetched_details").notNull().default(0),
  imported: integer("imported").notNull().default(0),
  activeExcluded: integer("active_excluded").notNull().default(0),
  error: text("error"),
}, (table) => [
  index("idx_sync_runs_status_started").on(table.status, table.startedAt),
  uniqueIndex("idx_one_running_sync").on(table.status).where(sql`${table.status} = 'running'`),
]);

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  displayId: text("display_id").notNull().unique(),
  section: text("section", { enum: ["reading-writing", "math"] }).notNull(),
  domainCode: text("domain_code").notNull(),
  domainName: text("domain_name").notNull(),
  skillCode: text("skill_code").notNull(),
  skillName: text("skill_name").notNull(),
  difficulty: text("difficulty", { enum: ["medium", "hard"] }).notNull(),
  type: text("type", { enum: ["mcq", "spr"] }).notNull(),
  stimulusHtml: text("stimulus_html"),
  stemHtml: text("stem_html").notNull(),
  rationaleHtml: text("rationale_html").notNull(),
  answerOptions: text("answer_options", { mode: "json" }).$type<AnswerOption[]>().notNull().default([]),
  correctAnswers: text("correct_answers", { mode: "json" }).$type<string[]>().notNull(),
  isActiveTest: integer("is_active_test", { mode: "boolean" }).notNull().default(false),
  isRetired: integer("is_retired", { mode: "boolean" }).notNull().default(false),
  sourceUpdatedAt: timestamp("source_updated_at"),
  contentHash: text("content_hash").notNull(),
  syncRunId: text("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (table) => [
  index("idx_questions_eligible_section").on(table.isRetired, table.isActiveTest, table.section),
  index("idx_questions_domain_skill").on(table.domainCode, table.skillCode),
]);

export const questionAssets = sqliteTable("question_assets", {
  id: text("id").primaryKey(),
  mimeType: text("mime_type").notNull(),
  filePath: text("file_path").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const practiceSessions = sqliteTable("practice_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  mode: text("mode", { enum: ["random", "topics"] }).notNull(),
  requestedCount: integer("requested_count").notNull(),
  status: text("status", { enum: ["active", "completed", "abandoned"] }).notNull().default("active"),
  topicFilters: text("topic_filters", { mode: "json" }).$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull(),
  completedAt: timestamp("completed_at"),
  abandonedAt: timestamp("abandoned_at"),
}, (table) => [
  index("idx_practice_sessions_user_status").on(table.userId, table.status),
  uniqueIndex("idx_one_active_session_per_user").on(table.userId).where(sql`${table.status} = 'active'`),
]);

export const practiceSessionItems = sqliteTable("practice_session_items", {
  sessionId: text("session_id").notNull().references(() => practiceSessions.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "restrict" }),
  position: integer("position").notNull(),
  firstAttemptCorrect: integer("first_attempt_correct", { mode: "boolean" }),
  retryCount: integer("retry_count").notNull().default(0),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.questionId] }),
  uniqueIndex("idx_session_items_position").on(table.sessionId, table.position),
]);

export const answerAttempts = sqliteTable("answer_attempts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => practiceSessions.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "restrict" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").notNull(),
  response: text("response").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  createdAt: timestamp("created_at").notNull(),
}, (table) => [index("idx_attempts_session_question").on(table.sessionId, table.questionId)]);

export const userQuestionProgress = sqliteTable("user_question_progress", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["review", "mastered"] }).notNull(),
  firstAttemptMisses: integer("first_attempt_misses").notNull().default(0),
  lastAnsweredAt: timestamp("last_answered_at").notNull(),
  masteredAt: timestamp("mastered_at"),
}, (table) => [
  primaryKey({ columns: [table.userId, table.questionId] }),
  index("idx_progress_user_status").on(table.userId, table.status),
]);
