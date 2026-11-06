UPDATE `convention`
SET `default_city` = (
  SELECT `edition`.`city`
  FROM `edition`
  WHERE `edition`.`convention_id` = `convention`.`id`
    AND `edition`.`city` IS NOT NULL
    AND `edition`.`city` != ''
  LIMIT 1
)
WHERE (`default_city` IS NULL OR `default_city` = '')
  AND EXISTS (
    SELECT 1
    FROM `edition`
    WHERE `edition`.`convention_id` = `convention`.`id`
      AND `edition`.`city` IS NOT NULL
      AND `edition`.`city` != ''
  );--> statement-breakpoint
UPDATE `convention`
SET `default_region` = (
  SELECT `edition`.`region`
  FROM `edition`
  WHERE `edition`.`convention_id` = `convention`.`id`
    AND `edition`.`region` IS NOT NULL
    AND `edition`.`region` != ''
  LIMIT 1
)
WHERE (`default_region` IS NULL OR `default_region` = '')
  AND EXISTS (
    SELECT 1
    FROM `edition`
    WHERE `edition`.`convention_id` = `convention`.`id`
      AND `edition`.`region` IS NOT NULL
      AND `edition`.`region` != ''
  );--> statement-breakpoint
ALTER TABLE `edition` DROP COLUMN `city`;--> statement-breakpoint
ALTER TABLE `edition` DROP COLUMN `region`;
