-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'ADMIN', 'LIBRARIAN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "penalty_type" AS ENUM ('NO_SHOW', 'LATE_CANCELLATION', 'REPEATED_OFFENSE');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('RESERVATION_REMINDER', 'CANCELLATION', 'PENALTY', 'SYSTEM', 'BAN_WARNING');

-- CreateEnum
CREATE TYPE "admin_action_type" AS ENUM ('USER_BANNED', 'USER_UNBANNED', 'PENALTY_ADDED', 'PENALTY_REMOVED', 'RESERVATION_CANCELLED', 'RESERVATION_FORCE_CHECKIN', 'ROOM_CREATED', 'ROOM_UPDATED', 'ROOM_DEACTIVATED', 'SETTINGS_UPDATED', 'USER_ROLE_CHANGED', 'BULK_OPERATION');

-- CreateEnum
CREATE TYPE "bulk_operation_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED');

-- CreateEnum
CREATE TYPE "announcement_priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "student_number" VARCHAR(20),
    "email" VARCHAR(255) NOT NULL,
    "email_verified" TIMESTAMP(6),
    "password" VARCHAR(255),
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "department" VARCHAR(100),
    "image" VARCHAR(500),
    "avatar_url" VARCHAR(500),
    "role" "user_role" NOT NULL DEFAULT 'STUDENT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "penalty_points" INTEGER NOT NULL DEFAULT 0,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_until" TIMESTAMP(6),
    "ban_reason" TEXT,
    "last_login_at" TIMESTAMP(6),
    "last_login_ip" INET,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(6) NOT NULL
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "room_number" VARCHAR(10) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 7,
    "floor" INTEGER,
    "description" TEXT,
    "amenities" JSONB,
    "image_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reservation_date" DATE NOT NULL,
    "start_time" TIME(6) NOT NULL,
    "end_time" TIME(6) NOT NULL,
    "participant_count" INTEGER NOT NULL,
    "participants" JSONB,
    "purpose" TEXT,
    "status" "reservation_status" NOT NULL DEFAULT 'PENDING',
    "cancelled_at" TIMESTAMP(6),
    "cancellation_reason" TEXT,
    "checked_in_at" TIMESTAMP(6),
    "checked_in_by" UUID,
    "no_show" BOOLEAN NOT NULL DEFAULT false,
    "penalty_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reservation_id" UUID,
    "penalty_type" "penalty_type" NOT NULL,
    "penalty_points" INTEGER NOT NULL,
    "description" TEXT,
    "applied_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "penalty_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "setting_key" VARCHAR(100) NOT NULL,
    "setting_value" JSONB NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_rules" (
    "id" UUID NOT NULL,
    "rule_name" VARCHAR(100) NOT NULL,
    "rule_type" VARCHAR(50) NOT NULL,
    "rule_value" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "related_entity_type" VARCHAR(50),
    "related_entity_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action_type" "admin_action_type" NOT NULL,
    "target_entity_type" VARCHAR(50) NOT NULL,
    "target_entity_id" UUID,
    "affected_user_id" UUID,
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_stats" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_reservations" INTEGER NOT NULL DEFAULT 0,
    "completed_reservations" INTEGER NOT NULL DEFAULT 0,
    "cancelled_reservations" INTEGER NOT NULL DEFAULT 0,
    "no_show_reservations" INTEGER NOT NULL DEFAULT 0,
    "active_users" INTEGER NOT NULL DEFAULT 0,
    "new_users" INTEGER NOT NULL DEFAULT 0,
    "banned_users" INTEGER NOT NULL DEFAULT 0,
    "room_utilization_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average_session_duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "peak_hours" JSONB,
    "total_penalties_issued" INTEGER NOT NULL DEFAULT 0,
    "total_penalty_points" INTEGER NOT NULL DEFAULT 0,
    "room_stats" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "dashboard_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_operations" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "operation_type" VARCHAR(50) NOT NULL,
    "total_items" INTEGER NOT NULL,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "success_items" INTEGER NOT NULL DEFAULT 0,
    "failed_items" INTEGER NOT NULL DEFAULT 0,
    "status" "bulk_operation_status" NOT NULL DEFAULT 'PENDING',
    "parameters" JSONB,
    "results" JSONB,
    "error_log" JSONB,
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "announcement_priority" NOT NULL DEFAULT 'MEDIUM',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "target_role" "user_role",
    "published_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "report_type" VARCHAR(50) NOT NULL,
    "query" JSONB NOT NULL,
    "columns" JSONB NOT NULL,
    "filters" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" UUID NOT NULL,
    "task_name" VARCHAR(100) NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "cron_expression" VARCHAR(50),
    "scheduled_for" TIMESTAMP(6),
    "status" "task_status" NOT NULL DEFAULT 'SCHEDULED',
    "parameters" JSONB,
    "result" JSONB,
    "error_message" TEXT,
    "execution_time" INTEGER,
    "last_run_at" TIMESTAMP(6),
    "next_run_at" TIMESTAMP(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" UUID NOT NULL,
    "to" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "status" VARCHAR(20) NOT NULL,
    "sent_at" TIMESTAMP(6),
    "failed_at" TIMESTAMP(6),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_student_number_key" ON "users"("student_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_student_number_idx" ON "users"("student_number");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_penalty_points_idx" ON "users"("penalty_points");

-- CreateIndex
CREATE INDEX "users_is_banned_idx" ON "users"("is_banned");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_number_key" ON "rooms"("room_number");

-- CreateIndex
CREATE INDEX "reservations_room_id_reservation_date_idx" ON "reservations"("room_id", "reservation_date");

-- CreateIndex
CREATE INDEX "reservations_user_id_idx" ON "reservations"("user_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_reservation_date_start_time_idx" ON "reservations"("reservation_date", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_user_id_reservation_date_start_time_key" ON "reservations"("user_id", "reservation_date", "start_time");

-- CreateIndex
CREATE INDEX "penalty_history_user_id_idx" ON "penalty_history"("user_id");

-- CreateIndex
CREATE INDEX "penalty_history_is_active_idx" ON "penalty_history"("is_active");

-- CreateIndex
CREATE INDEX "penalty_history_applied_at_idx" ON "penalty_history"("applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_setting_key_key" ON "system_settings"("setting_key");

-- CreateIndex
CREATE INDEX "system_settings_category_idx" ON "system_settings"("category");

-- CreateIndex
CREATE INDEX "system_settings_is_public_idx" ON "system_settings"("is_public");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_rules_rule_name_key" ON "reservation_rules"("rule_name");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_sent_at_idx" ON "notifications"("sent_at");

-- CreateIndex
CREATE INDEX "admin_actions_admin_id_idx" ON "admin_actions"("admin_id");

-- CreateIndex
CREATE INDEX "admin_actions_action_type_idx" ON "admin_actions"("action_type");

-- CreateIndex
CREATE INDEX "admin_actions_target_entity_type_target_entity_id_idx" ON "admin_actions"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "admin_actions_created_at_idx" ON "admin_actions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_stats_date_key" ON "dashboard_stats"("date");

-- CreateIndex
CREATE INDEX "dashboard_stats_date_idx" ON "dashboard_stats"("date");

-- CreateIndex
CREATE INDEX "bulk_operations_admin_id_idx" ON "bulk_operations"("admin_id");

-- CreateIndex
CREATE INDEX "bulk_operations_status_idx" ON "bulk_operations"("status");

-- CreateIndex
CREATE INDEX "bulk_operations_created_at_idx" ON "bulk_operations"("created_at");

-- CreateIndex
CREATE INDEX "announcements_is_active_is_pinned_idx" ON "announcements"("is_active", "is_pinned");

-- CreateIndex
CREATE INDEX "announcements_published_at_idx" ON "announcements"("published_at");

-- CreateIndex
CREATE INDEX "announcements_target_role_idx" ON "announcements"("target_role");

-- CreateIndex
CREATE INDEX "report_templates_report_type_idx" ON "report_templates"("report_type");

-- CreateIndex
CREATE INDEX "report_templates_is_active_idx" ON "report_templates"("is_active");

-- CreateIndex
CREATE INDEX "scheduled_tasks_status_idx" ON "scheduled_tasks"("status");

-- CreateIndex
CREATE INDEX "scheduled_tasks_next_run_at_idx" ON "scheduled_tasks"("next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_tasks_task_type_idx" ON "scheduled_tasks"("task_type");

-- CreateIndex
CREATE INDEX "email_queue_status_idx" ON "email_queue"("status");

-- CreateIndex
CREATE INDEX "email_queue_priority_idx" ON "email_queue"("priority");

-- CreateIndex
CREATE INDEX "email_queue_created_at_idx" ON "email_queue"("created_at");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_history" ADD CONSTRAINT "penalty_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_history" ADD CONSTRAINT "penalty_history_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_affected_user_id_fkey" FOREIGN KEY ("affected_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
