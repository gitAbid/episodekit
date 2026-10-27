CREATE TYPE "public"."artifact_kind" AS ENUM('show_notes', 'chapters', 'summary', 'titles', 'blog', 'newsletter', 'social', 'quotes');--> statement-breakpoint
CREATE TYPE "public"."artifact_status" AS ENUM('pending', 'writing', 'ready', 'failed', 'fallback');--> statement-breakpoint
CREATE TYPE "public"."episode_source" AS ENUM('upload', 'paste', 'sample');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('uploading', 'queued', 'transcribing', 'writing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."plan_source" AS ENUM('ls', 'manual');--> statement-breakpoint
CREATE TYPE "public"."usage_kind" AS ENUM('asr', 'llm', 'free_tool');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TABLE "analysis" (
	"episode_id" uuid PRIMARY KEY NOT NULL,
	"chapters" jsonb,
	"topics" text[],
	"candidate_quotes" jsonb
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"kind" "artifact_kind" NOT NULL,
	"status" "artifact_status" NOT NULL,
	"content" jsonb,
	"previous_content" jsonb,
	"ready_flag" boolean DEFAULT false NOT NULL,
	"regen_count" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"model" text,
	"error_code" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifacts_episode_id_kind_unique" UNIQUE("episode_id","kind")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"title" text,
	"number" integer,
	"guests" jsonb,
	"source" "episode_source" NOT NULL,
	"audio_blob_path" text,
	"duration_ms" integer,
	"has_timestamps" boolean DEFAULT false NOT NULL,
	"has_speakers" boolean DEFAULT false NOT NULL,
	"status" "episode_status" NOT NULL,
	"error_code" text,
	"quota_month" char(7),
	"counts_quota" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"episode_id" uuid,
	"artifact_kind" "artifact_kind",
	"rating" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" text PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"speaker" text,
	"start_ms" integer,
	"end_ms" integer,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rss_url" text,
	"artwork_url" text,
	"listen_url" text,
	"default_cta" text,
	"vocabulary" text[] DEFAULT '{}' NOT NULL,
	"voice_profile" jsonb,
	"voice_samples" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shows_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"episode_id" uuid,
	"kind" "usage_kind" NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"units" integer NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"plan_source" "plan_source",
	"founding" boolean DEFAULT false NOT NULL,
	"ls_customer_id" text,
	"ls_subscription_id" text,
	"status" "workspace_status" DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis" ADD CONSTRAINT "analysis_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shows" ADD CONSTRAINT "shows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;