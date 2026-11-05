PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `convention_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`display_name` text NOT NULL,
	`normalized` text NOT NULL,
	`website` text,
	`default_venue` text,
	`default_address` text,
	`default_city` text,
	`default_region` text,
	`default_postal_code` text,
	`default_country` text,
	`estimated_attendance` integer,
	`manual_interest` integer DEFAULT 0 NOT NULL,
	`drive_minutes` integer,
	`drive_source` text,
	`notes` text
);
--> statement-breakpoint
INSERT INTO `convention_new` (
	`id`,
	`display_name`,
	`normalized`,
	`website`,
	`default_venue`,
	`default_address`,
	`default_city`,
	`default_region`,
	`default_postal_code`,
	`default_country`,
	`estimated_attendance`,
	`manual_interest`,
	`drive_minutes`,
	`drive_source`,
	`notes`
)
SELECT
	c.`id`,
	c.`display_name`,
	c.`normalized`,
	c.`website`,
	r.`venue`,
	NULL,
	r.`city`,
	r.`region`,
	NULL,
	r.`country`,
	a.`attendance`,
	0,
	NULL,
	NULL,
	c.`notes`
FROM `convention` AS c
LEFT JOIN (
	SELECT `convention_id`, `venue`, `city`, `region`, `country`
	FROM (
		SELECT
			`convention_id`,
			`venue`,
			`city`,
			`region`,
			`country`,
			ROW_NUMBER() OVER (
				PARTITION BY `convention_id`
				ORDER BY
					CASE
						WHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN 0
						WHEN `start_date` IS NOT NULL THEN 1
						ELSE 2
					END,
					CASE WHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN `start_date` END ASC,
					CASE WHEN `start_date` IS NOT NULL AND `start_date` < date('now') THEN `start_date` END DESC,
					CASE WHEN `start_date` IS NULL THEN `cycle_label` END DESC,
					`cycle_label` ASC
			) AS `rn`
		FROM `edition`
	) AS ranked
	WHERE ranked.`rn` = 1
) AS r ON r.`convention_id` = c.`id`
LEFT JOIN (
	SELECT `convention_id`, `attendance`
	FROM (
		SELECT
			`convention_id`,
			`attendance`,
			ROW_NUMBER() OVER (
				PARTITION BY `convention_id`
				ORDER BY
					CASE
						WHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN 0
						WHEN `start_date` IS NOT NULL THEN 1
						ELSE 2
					END,
					CASE WHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN `start_date` END ASC,
					CASE WHEN `start_date` IS NOT NULL AND `start_date` < date('now') THEN `start_date` END DESC,
					CASE WHEN `start_date` IS NULL THEN `cycle_label` END DESC,
					`cycle_label` ASC
			) AS `rn`
		FROM `edition`
		WHERE `attendance` IS NOT NULL
	) AS ranked_attendance
	WHERE ranked_attendance.`rn` = 1
) AS a ON a.`convention_id` = c.`id`;
--> statement-breakpoint
CREATE TABLE `edition_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`convention_id` integer NOT NULL,
	`cycle_label` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`application_start_date` text,
	`application_end_date` text,
	`start_date_calendar_event_id` text,
	`application_start_date_calendar_event_id` text,
	`venue` text,
	`address` text,
	`city` text,
	`region` text,
	`postal_code` text,
	`country` text,
	`status` text NOT NULL,
	`submitted_at` text,
	`result_date` text,
	`paid` integer DEFAULT false NOT NULL,
	`notes` text,
	`sheet_row_key` text,
	FOREIGN KEY (`convention_id`) REFERENCES `convention_new`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `edition_new` (
	`id`,
	`convention_id`,
	`cycle_label`,
	`start_date`,
	`end_date`,
	`application_start_date`,
	`application_end_date`,
	`start_date_calendar_event_id`,
	`application_start_date_calendar_event_id`,
	`venue`,
	`address`,
	`city`,
	`region`,
	`postal_code`,
	`country`,
	`status`,
	`submitted_at`,
	`result_date`,
	`paid`,
	`notes`,
	`sheet_row_key`
)
SELECT
	`id`,
	`convention_id`,
	`cycle_label`,
	`start_date`,
	`end_date`,
	`application_start_date`,
	`application_end_date`,
	`start_date_calendar_event_id`,
	`application_start_date_calendar_event_id`,
	`venue`,
	NULL,
	`city`,
	`region`,
	NULL,
	`country`,
	CASE `status`
		WHEN 'accepted' THEN 'approved'
		WHEN 'not_open' THEN 'waiting_to_apply'
		ELSE `status`
	END,
	`submitted_at`,
	`result_at`,
	`paid`,
	`notes`,
	`sheet_row_key`
FROM `edition`;
--> statement-breakpoint
CREATE TABLE `edition_link_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`edition_id` integer NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	FOREIGN KEY (`edition_id`) REFERENCES `edition_new`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `edition_link_new` (`id`, `edition_id`, `url`, `kind`)
SELECT `id`, `edition_id`, `url`, `kind` FROM `edition_link`;
--> statement-breakpoint
DROP TABLE `edition_link`;
--> statement-breakpoint
DROP TABLE `edition`;
--> statement-breakpoint
DROP TABLE `convention`;
--> statement-breakpoint
ALTER TABLE `convention_new` RENAME TO `convention`;
--> statement-breakpoint
ALTER TABLE `edition_new` RENAME TO `edition`;
--> statement-breakpoint
ALTER TABLE `edition_link_new` RENAME TO `edition_link`;
--> statement-breakpoint
CREATE UNIQUE INDEX `convention_normalized_unique` ON `convention` (`normalized`);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_convention_cycle` ON `edition` (`convention_id`,`cycle_label`);
--> statement-breakpoint
CREATE UNIQUE INDEX `edition_sheet_row_key_unique` ON `edition` (`sheet_row_key`);
--> statement-breakpoint
DELETE FROM `sqlite_sequence` WHERE `name` IN ('convention', 'edition', 'edition_link', 'convention_new', 'edition_new', 'edition_link_new');
--> statement-breakpoint
INSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT 'convention', COALESCE(MAX(`id`), 0) FROM `convention`;
--> statement-breakpoint
INSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT 'edition', COALESCE(MAX(`id`), 0) FROM `edition`;
--> statement-breakpoint
INSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT 'edition_link', COALESCE(MAX(`id`), 0) FROM `edition_link`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
