CREATE TABLE `calendar_sync` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer,
	`reminder_kind` text NOT NULL,
	`action` text NOT NULL,
	`google_event_id` text,
	`state` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `google_credential` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`refresh_token` text NOT NULL,
	`access_token` text,
	`expiry` integer,
	`scopes` text NOT NULL,
	`history_id` text
);
--> statement-breakpoint
CREATE TABLE `setting` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner_email` text,
	`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,
	`drive_limit_hours` integer DEFAULT 12 NOT NULL,
	`calendar_id` text DEFAULT 'primary' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `edition` ADD `start_reminder_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `edition` ADD `application_start_reminder_enabled` integer DEFAULT false NOT NULL;