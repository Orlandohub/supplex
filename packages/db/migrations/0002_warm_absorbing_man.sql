CREATE TABLE IF NOT EXISTS "workflow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"event_description" text NOT NULL,
	"actor_user_id" uuid,
	"actor_name" varchar(200) NOT NULL,
	"actor_role" varchar(50) NOT NULL,
	"target_document_id" uuid,
	"target_document_name" varchar(255),
	"target_stage_number" integer,
	"target_reviewer_name" varchar(200),
	"comments" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_preferences_user_event_unique" UNIQUE("user_id","event_type")
);
--> statement-breakpoint
ALTER TABLE "qualification_workflows" RENAME COLUMN "snapshoted_checklist" TO "snapshotted_checklist";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Clean up orphaned workflow_events before adding FK constraint
DELETE FROM "workflow_events" 
WHERE "workflow_id" NOT IN (SELECT "id" FROM "qualification_workflows");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_workflow_id_qualification_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."qualification_workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_events" ADD CONSTRAINT "workflow_events_target_document_id_documents_id_fk" FOREIGN KEY ("target_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_notifications" ADD CONSTRAINT "email_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_events_workflow_created" ON "workflow_events" ("workflow_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_events_tenant_workflow" ON "workflow_events" ("tenant_id","workflow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_events_type" ON "workflow_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_notifications_tenant_status" ON "email_notifications" ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_email_notifications_created_at" ON "email_notifications" ("created_at");