DROP INDEX `albums_name_unique`;--> statement-breakpoint
ALTER TABLE `albums` ADD `owner_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `albums_owner_name_unique` ON `albums` (`owner_id`,`name`);--> statement-breakpoint
ALTER TABLE `photos` ADD `owner_id` text;