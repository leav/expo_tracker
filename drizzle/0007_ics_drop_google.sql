DROP TABLE `calendar_sync`;--> statement-breakpoint
DROP TABLE `google_credential`;--> statement-breakpoint
ALTER TABLE `edition` DROP COLUMN `start_date_calendar_event_id`;--> statement-breakpoint
ALTER TABLE `edition` DROP COLUMN `application_start_date_calendar_event_id`;--> statement-breakpoint
ALTER TABLE `edition` DROP COLUMN `start_reminder_enabled`;--> statement-breakpoint
ALTER TABLE `edition` DROP COLUMN `application_start_reminder_enabled`;--> statement-breakpoint
ALTER TABLE `setting` DROP COLUMN `owner_email`;--> statement-breakpoint
ALTER TABLE `setting` DROP COLUMN `calendar_id`;
