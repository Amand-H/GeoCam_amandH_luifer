CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uri` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`accuracy` real,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
