-- Aktualizacja schematu dla motywów konwersacji
ALTER TABLE conversations
	ADD COLUMN theme_key VARCHAR(64) NULL AFTER disappearing_messages_enabled_by,
	ADD COLUMN theme_settings JSON NULL AFTER theme_key;

ALTER TABLE messages
	ADD COLUMN message_type ENUM('user','system') NOT NULL DEFAULT 'user' AFTER is_encrypted,
	ADD COLUMN system_payload JSON NULL AFTER message_type;

