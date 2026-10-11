CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_name_unique` ON `albums` (`name`);--> statement-breakpoint
ALTER TABLE `photos` ADD `album_id` integer REFERENCES albums(id);--> statement-breakpoint
ALTER TABLE `photos` ADD `note` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `favorite` integer DEFAULT false NOT NULL;