CREATE TABLE `edition_link` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `import_proposal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`payload_json` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_proposal_dedupe_key_unique` ON `import_proposal` (`dedupe_key`);--> statement-breakpoint
ALTER TABLE `edition` ADD `sheet_row_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `edition_sheet_row_key_unique` ON `edition` (`sheet_row_key`);