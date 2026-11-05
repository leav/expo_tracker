CREATE TABLE `alias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`convention_id` integer NOT NULL,
	`name` text NOT NULL,
	`normalized` text NOT NULL,
	FOREIGN KEY (`convention_id`) REFERENCES `convention`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alias_normalized_unique` ON `alias` (`normalized`);--> statement-breakpoint
CREATE TABLE `convention` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`normalized` text NOT NULL,
	`website` text,
	`polling_enabled` integer DEFAULT false NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `convention_normalized_unique` ON `convention` (`normalized`);--> statement-breakpoint
CREATE TABLE `edition` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`convention_id` integer NOT NULL,
	`cycle_label` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`application_start_date` text,
	`application_end_date` text,
	`application_confirmed` integer DEFAULT false NOT NULL,
	`start_date_calendar_event_id` text,
	`application_start_date_calendar_event_id` text,
	`venue` text,
	`city` text,
	`region` text,
	`country` text,
	`attendance` integer,
	`intent` text NOT NULL,
	`status` text NOT NULL,
	`submitted_at` text,
	`result_at` text,
	`paid` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`convention_id`) REFERENCES `convention`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_convention_cycle` ON `edition` (`convention_id`,`cycle_label`);