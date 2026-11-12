import type { BundledMigration } from "./migrations";

export const bundledMigrations: BundledMigration[] = [
  {
    "sql": [
      "CREATE TABLE `alias` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`convention_id` integer NOT NULL,\n\t`name` text NOT NULL,\n\t`normalized` text NOT NULL,\n\tFOREIGN KEY (`convention_id`) REFERENCES `convention`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
      "\nCREATE UNIQUE INDEX `alias_normalized_unique` ON `alias` (`normalized`);",
      "\nCREATE TABLE `convention` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`display_name` text NOT NULL,\n\t`normalized` text NOT NULL,\n\t`website` text,\n\t`polling_enabled` integer DEFAULT false NOT NULL,\n\t`notes` text\n);\n",
      "\nCREATE UNIQUE INDEX `convention_normalized_unique` ON `convention` (`normalized`);",
      "\nCREATE TABLE `edition` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`convention_id` integer NOT NULL,\n\t`cycle_label` text NOT NULL,\n\t`start_date` text,\n\t`end_date` text,\n\t`application_start_date` text,\n\t`application_end_date` text,\n\t`application_confirmed` integer DEFAULT false NOT NULL,\n\t`start_date_calendar_event_id` text,\n\t`application_start_date_calendar_event_id` text,\n\t`venue` text,\n\t`city` text,\n\t`region` text,\n\t`country` text,\n\t`attendance` integer,\n\t`intent` text NOT NULL,\n\t`status` text NOT NULL,\n\t`submitted_at` text,\n\t`result_at` text,\n\t`paid` integer DEFAULT false NOT NULL,\n\t`notes` text,\n\tFOREIGN KEY (`convention_id`) REFERENCES `convention`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
      "\nCREATE UNIQUE INDEX `edition_convention_cycle` ON `edition` (`convention_id`,`cycle_label`);"
    ],
    "bps": true,
    "folderMillis": 1793827496756,
    "hash": "3b3427d5276b6455b5b83cb0f90032e59da6985d73805164329b76c2820b6fa4"
  },
  {
    "sql": [
      "CREATE TABLE `edition_link` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`edition_id` integer NOT NULL,\n\t`url` text NOT NULL,\n\t`kind` text NOT NULL,\n\tFOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
      "\nCREATE TABLE `import_proposal` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`kind` text NOT NULL,\n\t`dedupe_key` text NOT NULL,\n\t`payload_json` text NOT NULL,\n\t`state` text DEFAULT 'pending' NOT NULL\n);\n",
      "\nCREATE UNIQUE INDEX `import_proposal_dedupe_key_unique` ON `import_proposal` (`dedupe_key`);",
      "\nALTER TABLE `edition` ADD `sheet_row_key` text;",
      "\nCREATE UNIQUE INDEX `edition_sheet_row_key_unique` ON `edition` (`sheet_row_key`);"
    ],
    "bps": true,
    "folderMillis": 1793853071027,
    "hash": "8a0e0b8a02a49b7497d8dd21f8da5ea1c18ca577ac1893586b18cc6d092ab112"
  },
  {
    "sql": [
      "PRAGMA foreign_keys=OFF;\n",
      "\nCREATE TABLE `convention_new` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`display_name` text NOT NULL,\n\t`normalized` text NOT NULL,\n\t`website` text,\n\t`default_venue` text,\n\t`default_address` text,\n\t`default_city` text,\n\t`default_region` text,\n\t`default_postal_code` text,\n\t`default_country` text,\n\t`estimated_attendance` integer,\n\t`manual_interest` integer DEFAULT 0 NOT NULL,\n\t`drive_minutes` integer,\n\t`drive_source` text,\n\t`notes` text\n);\n",
      "\nINSERT INTO `convention_new` (\n\t`id`,\n\t`display_name`,\n\t`normalized`,\n\t`website`,\n\t`default_venue`,\n\t`default_address`,\n\t`default_city`,\n\t`default_region`,\n\t`default_postal_code`,\n\t`default_country`,\n\t`estimated_attendance`,\n\t`manual_interest`,\n\t`drive_minutes`,\n\t`drive_source`,\n\t`notes`\n)\nSELECT\n\tc.`id`,\n\tc.`display_name`,\n\tc.`normalized`,\n\tc.`website`,\n\tr.`venue`,\n\tNULL,\n\tr.`city`,\n\tr.`region`,\n\tNULL,\n\tr.`country`,\n\ta.`attendance`,\n\t0,\n\tNULL,\n\tNULL,\n\tc.`notes`\nFROM `convention` AS c\nLEFT JOIN (\n\tSELECT `convention_id`, `venue`, `city`, `region`, `country`\n\tFROM (\n\t\tSELECT\n\t\t\t`convention_id`,\n\t\t\t`venue`,\n\t\t\t`city`,\n\t\t\t`region`,\n\t\t\t`country`,\n\t\t\tROW_NUMBER() OVER (\n\t\t\t\tPARTITION BY `convention_id`\n\t\t\t\tORDER BY\n\t\t\t\t\tCASE\n\t\t\t\t\t\tWHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN 0\n\t\t\t\t\t\tWHEN `start_date` IS NOT NULL THEN 1\n\t\t\t\t\t\tELSE 2\n\t\t\t\t\tEND,\n\t\t\t\t\tCASE WHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN `start_date` END ASC,\n\t\t\t\t\tCASE WHEN `start_date` IS NOT NULL AND `start_date` < date('now') THEN `start_date` END DESC,\n\t\t\t\t\tCASE WHEN `start_date` IS NULL THEN `cycle_label` END DESC,\n\t\t\t\t\t`cycle_label` ASC\n\t\t\t) AS `rn`\n\t\tFROM `edition`\n\t) AS ranked\n\tWHERE ranked.`rn` = 1\n) AS r ON r.`convention_id` = c.`id`\nLEFT JOIN (\n\tSELECT `convention_id`, `attendance`\n\tFROM (\n\t\tSELECT\n\t\t\t`convention_id`,\n\t\t\t`attendance`,\n\t\t\tROW_NUMBER() OVER (\n\t\t\t\tPARTITION BY `convention_id`\n\t\t\t\tORDER BY\n\t\t\t\t\tCASE\n\t\t\t\t\t\tWHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN 0\n\t\t\t\t\t\tWHEN `start_date` IS NOT NULL THEN 1\n\t\t\t\t\t\tELSE 2\n\t\t\t\t\tEND,\n\t\t\t\t\tCASE WHEN `start_date` IS NOT NULL AND `start_date` >= date('now') THEN `start_date` END ASC,\n\t\t\t\t\tCASE WHEN `start_date` IS NOT NULL AND `start_date` < date('now') THEN `start_date` END DESC,\n\t\t\t\t\tCASE WHEN `start_date` IS NULL THEN `cycle_label` END DESC,\n\t\t\t\t\t`cycle_label` ASC\n\t\t\t) AS `rn`\n\t\tFROM `edition`\n\t\tWHERE `attendance` IS NOT NULL\n\t) AS ranked_attendance\n\tWHERE ranked_attendance.`rn` = 1\n) AS a ON a.`convention_id` = c.`id`;\n",
      "\nCREATE TABLE `edition_new` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`convention_id` integer NOT NULL,\n\t`cycle_label` text NOT NULL,\n\t`start_date` text,\n\t`end_date` text,\n\t`application_start_date` text,\n\t`application_end_date` text,\n\t`start_date_calendar_event_id` text,\n\t`application_start_date_calendar_event_id` text,\n\t`venue` text,\n\t`address` text,\n\t`city` text,\n\t`region` text,\n\t`postal_code` text,\n\t`country` text,\n\t`status` text NOT NULL,\n\t`submitted_at` text,\n\t`result_date` text,\n\t`paid` integer DEFAULT false NOT NULL,\n\t`notes` text,\n\t`sheet_row_key` text,\n\tFOREIGN KEY (`convention_id`) REFERENCES `convention_new`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
      "\nINSERT INTO `edition_new` (\n\t`id`,\n\t`convention_id`,\n\t`cycle_label`,\n\t`start_date`,\n\t`end_date`,\n\t`application_start_date`,\n\t`application_end_date`,\n\t`start_date_calendar_event_id`,\n\t`application_start_date_calendar_event_id`,\n\t`venue`,\n\t`address`,\n\t`city`,\n\t`region`,\n\t`postal_code`,\n\t`country`,\n\t`status`,\n\t`submitted_at`,\n\t`result_date`,\n\t`paid`,\n\t`notes`,\n\t`sheet_row_key`\n)\nSELECT\n\t`id`,\n\t`convention_id`,\n\t`cycle_label`,\n\t`start_date`,\n\t`end_date`,\n\t`application_start_date`,\n\t`application_end_date`,\n\t`start_date_calendar_event_id`,\n\t`application_start_date_calendar_event_id`,\n\t`venue`,\n\tNULL,\n\t`city`,\n\t`region`,\n\tNULL,\n\t`country`,\n\tCASE `status`\n\t\tWHEN 'accepted' THEN 'approved'\n\t\tWHEN 'not_open' THEN 'waiting_to_apply'\n\t\tELSE `status`\n\tEND,\n\t`submitted_at`,\n\t`result_at`,\n\t`paid`,\n\t`notes`,\n\t`sheet_row_key`\nFROM `edition`;\n",
      "\nCREATE TABLE `edition_link_new` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`edition_id` integer NOT NULL,\n\t`url` text NOT NULL,\n\t`kind` text NOT NULL,\n\tFOREIGN KEY (`edition_id`) REFERENCES `edition_new`(`id`) ON UPDATE no action ON DELETE cascade\n);\n",
      "\nINSERT INTO `edition_link_new` (`id`, `edition_id`, `url`, `kind`)\nSELECT `id`, `edition_id`, `url`, `kind` FROM `edition_link`;\n",
      "\nDROP TABLE `edition_link`;\n",
      "\nDROP TABLE `edition`;\n",
      "\nDROP TABLE `convention`;\n",
      "\nALTER TABLE `convention_new` RENAME TO `convention`;\n",
      "\nALTER TABLE `edition_new` RENAME TO `edition`;\n",
      "\nALTER TABLE `edition_link_new` RENAME TO `edition_link`;\n",
      "\nCREATE UNIQUE INDEX `convention_normalized_unique` ON `convention` (`normalized`);\n",
      "\nCREATE UNIQUE INDEX `edition_convention_cycle` ON `edition` (`convention_id`,`cycle_label`);\n",
      "\nCREATE UNIQUE INDEX `edition_sheet_row_key_unique` ON `edition` (`sheet_row_key`);\n",
      "\nDELETE FROM `sqlite_sequence` WHERE `name` IN ('convention', 'edition', 'edition_link', 'convention_new', 'edition_new', 'edition_link_new');\n",
      "\nINSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT 'convention', COALESCE(MAX(`id`), 0) FROM `convention`;\n",
      "\nINSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT 'edition', COALESCE(MAX(`id`), 0) FROM `edition`;\n",
      "\nINSERT INTO `sqlite_sequence` (`name`, `seq`) SELECT 'edition_link', COALESCE(MAX(`id`), 0) FROM `edition_link`;\n",
      "\nPRAGMA foreign_keys=ON;\n"
    ],
    "bps": true,
    "folderMillis": 1793940000000,
    "hash": "22d2ca45a3be802845dd6d5a6acfbff36ff0be7682950502e68b4bf5296e29e8"
  },
  {
    "sql": [
      "ALTER TABLE `convention` DROP COLUMN `default_venue`;",
      "\nALTER TABLE `convention` DROP COLUMN `default_address`;",
      "\nALTER TABLE `convention` DROP COLUMN `default_postal_code`;",
      "\nALTER TABLE `convention` DROP COLUMN `default_country`;",
      "\nALTER TABLE `edition` DROP COLUMN `venue`;",
      "\nALTER TABLE `edition` DROP COLUMN `address`;",
      "\nALTER TABLE `edition` DROP COLUMN `postal_code`;",
      "\nALTER TABLE `edition` DROP COLUMN `country`;"
    ],
    "bps": true,
    "folderMillis": 1793916582916,
    "hash": "a5d9acfbede52b32f38426a20ef134c1bdcb1e710ac2073f8e9ab3feb284dd35"
  },
  {
    "sql": [
      "UPDATE `edition` SET `status` = 'skipped' WHERE `status` = 'passed';\n"
    ],
    "bps": true,
    "folderMillis": 1794000000000,
    "hash": "27fe24d152d48530127e846a7950426fb40b69ee2775301160e9be46a3e033f3"
  },
  {
    "sql": [
      "UPDATE `convention`\nSET `default_city` = (\n  SELECT `edition`.`city`\n  FROM `edition`\n  WHERE `edition`.`convention_id` = `convention`.`id`\n    AND `edition`.`city` IS NOT NULL\n    AND `edition`.`city` != ''\n  LIMIT 1\n)\nWHERE (`default_city` IS NULL OR `default_city` = '')\n  AND EXISTS (\n    SELECT 1\n    FROM `edition`\n    WHERE `edition`.`convention_id` = `convention`.`id`\n      AND `edition`.`city` IS NOT NULL\n      AND `edition`.`city` != ''\n  );",
      "\nUPDATE `convention`\nSET `default_region` = (\n  SELECT `edition`.`region`\n  FROM `edition`\n  WHERE `edition`.`convention_id` = `convention`.`id`\n    AND `edition`.`region` IS NOT NULL\n    AND `edition`.`region` != ''\n  LIMIT 1\n)\nWHERE (`default_region` IS NULL OR `default_region` = '')\n  AND EXISTS (\n    SELECT 1\n    FROM `edition`\n    WHERE `edition`.`convention_id` = `convention`.`id`\n      AND `edition`.`region` IS NOT NULL\n      AND `edition`.`region` != ''\n  );",
      "\nALTER TABLE `edition` DROP COLUMN `city`;",
      "\nALTER TABLE `edition` DROP COLUMN `region`;\n"
    ],
    "bps": true,
    "folderMillis": 1794100000000,
    "hash": "aeaa371352a9ee642163a6ebf8226636a10d9edd4dc1c12ec8d61bf384a33591"
  },
  {
    "sql": [
      "CREATE TABLE `calendar_sync` (\n\t`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n\t`edition_id` integer,\n\t`reminder_kind` text NOT NULL,\n\t`action` text NOT NULL,\n\t`google_event_id` text,\n\t`state` text DEFAULT 'queued' NOT NULL,\n\t`attempts` integer DEFAULT 0 NOT NULL,\n\t`last_error` text,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\tFOREIGN KEY (`edition_id`) REFERENCES `edition`(`id`) ON UPDATE no action ON DELETE set null\n);\n",
      "\nCREATE TABLE `google_credential` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`email` text NOT NULL,\n\t`refresh_token` text NOT NULL,\n\t`access_token` text,\n\t`expiry` integer,\n\t`scopes` text NOT NULL,\n\t`history_id` text\n);\n",
      "\nCREATE TABLE `setting` (\n\t`id` integer PRIMARY KEY NOT NULL,\n\t`owner_email` text,\n\t`timezone` text DEFAULT 'America/Los_Angeles' NOT NULL,\n\t`drive_limit_hours` integer DEFAULT 12 NOT NULL,\n\t`calendar_id` text DEFAULT 'primary' NOT NULL\n);\n",
      "\nALTER TABLE `edition` ADD `start_reminder_enabled` integer DEFAULT false NOT NULL;",
      "\nALTER TABLE `edition` ADD `application_start_reminder_enabled` integer DEFAULT false NOT NULL;"
    ],
    "bps": true,
    "folderMillis": 1794251317259,
    "hash": "eda14e73834e7f2b64810dabed78dbad508b2675bc232db2718abf5a19b93e18"
  },
  {
    "sql": [
      "DROP TABLE `calendar_sync`;",
      "\nDROP TABLE `google_credential`;",
      "\nALTER TABLE `edition` DROP COLUMN `start_date_calendar_event_id`;",
      "\nALTER TABLE `edition` DROP COLUMN `application_start_date_calendar_event_id`;",
      "\nALTER TABLE `edition` DROP COLUMN `start_reminder_enabled`;",
      "\nALTER TABLE `edition` DROP COLUMN `application_start_reminder_enabled`;",
      "\nALTER TABLE `setting` DROP COLUMN `owner_email`;",
      "\nALTER TABLE `setting` DROP COLUMN `calendar_id`;\n"
    ],
    "bps": true,
    "folderMillis": 1794300000000,
    "hash": "377953ac0220161a9dc12bbb1ba91760acb26022d9ee64efd8ed945791ae99c3"
  },
  {
    "sql": [
      "DROP TABLE `import_proposal`;",
      "\nDROP TABLE `setting`;",
      "\nALTER TABLE `convention` DROP COLUMN `drive_minutes`;",
      "\nALTER TABLE `convention` DROP COLUMN `drive_source`;"
    ],
    "bps": true,
    "folderMillis": 1794448887803,
    "hash": "f14a4fbe21804e80735f9457341e394cf946ee7f031771f7eb4e493411209b12"
  }
];
