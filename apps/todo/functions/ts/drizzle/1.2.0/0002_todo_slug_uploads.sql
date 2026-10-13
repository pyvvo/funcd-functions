CREATE TABLE `uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`todo_id` integer NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`object_version` text NOT NULL,
	`recorded_by` text NOT NULL,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uploads_todo_name` ON `uploads` (`todo_id`,`name`);--> statement-breakpoint
ALTER TABLE `todos` ADD `slug` text;--> statement-breakpoint
CREATE UNIQUE INDEX `todos_slug_unique` ON `todos` (`slug`);