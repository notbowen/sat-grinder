ALTER TABLE `account` ADD `issuer` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_account_issuer_account` ON `account` (`issuer`,`account_id`);