CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`industry` text DEFAULT '其他' NOT NULL,
	`level` text DEFAULT 'B' NOT NULL,
	`status` text DEFAULT '待联系' NOT NULL,
	`pool` text DEFAULT 'mine' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '手动录入' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`market` text DEFAULT '' NOT NULL,
	`route` text DEFAULT '' NOT NULL,
	`balance_due` integer DEFAULT 0 NOT NULL,
	`credit_limit` integer DEFAULT 0 NOT NULL,
	`demo` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_user_name` ON `customers` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`order_id` text NOT NULL,
	`location` text NOT NULL,
	`description` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `followups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`content` text NOT NULL,
	`method` text NOT NULL,
	`created_at` text NOT NULL,
	`demo` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`number` text NOT NULL,
	`customer_id` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`mode` text NOT NULL,
	`cargo` text NOT NULL,
	`weight` text DEFAULT '0' NOT NULL,
	`volume` text DEFAULT '0' NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`status` text DEFAULT '待核价' NOT NULL,
	`validity` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`number` text NOT NULL,
	`customer_id` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`mode` text NOT NULL,
	`cargo` text NOT NULL,
	`status` text DEFAULT '待入仓' NOT NULL,
	`eta` text DEFAULT '' NOT NULL,
	`exception` text DEFAULT '' NOT NULL,
	`documents` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '我的销售团队' NOT NULL,
	`motto` text DEFAULT '认真对待每一次连接' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`customer_id` text,
	`title` text NOT NULL,
	`due_date` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`demo` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
