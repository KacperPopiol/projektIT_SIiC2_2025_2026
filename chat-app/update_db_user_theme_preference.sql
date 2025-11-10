-- Dodanie preferencji motywu dla użytkowników
ALTER TABLE users
	ADD COLUMN theme_preference ENUM('light','dark') NOT NULL DEFAULT 'light' AFTER default_disappearing_time;

