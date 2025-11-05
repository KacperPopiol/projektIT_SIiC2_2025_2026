-- ============================================
-- INSTRUKCJA DLA DEVELOPERA
-- ============================================
-- Po pobraniu brancha z feature znikających wiadomości:
--:
-- 1. Otwórz MySQL Workbench
-- 2. Połącz się z bazą: chat_app_db
-- 3. Otwórz ten plik: chat-app/update_db_disappearing_messages.sql
-- 4. Wykonaj cały skrypt (Ctrl+Shift+Enter lub przycisk Execute)
--
-- 3. Po wykonaniu skryptu uruchom serwer: npm run dev
-- ============================================





-- ============================================
-- SKRYPT AKTUALIZACJI BAZY DANYCH
-- Znikające wiadomości - dodanie brakujących kolumn
-- ============================================
-- SKRYPT AKTUALIZACJI BAZY DANYCH
-- Znikające wiadomości - dodanie brakujących kolumn
-- ============================================

USE chat_app_db;

-- ============================================
-- 1. SPRAWDZENIE STRUKTURY TABEL (PRZED)
-- ============================================

SELECT '=== STRUKTURA PRZED AKTUALIZACJĄ ===' AS info;

SELECT 'conversations' AS tabela;
DESCRIBE conversations;

SELECT 'users' AS tabela;
DESCRIBE users;

SELECT 'message_read_status' AS tabela;
DESCRIBE message_read_status;

-- ============================================
-- 2. DODANIE KOLUMN DO TABELI conversations
-- ============================================

-- Sprawdź i dodaj disappearing_messages_enabled
SET @dbname = DATABASE();
SET @tablename = 'conversations';
SET @columnname = 'disappearing_messages_enabled';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' BOOLEAN NOT NULL DEFAULT FALSE')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Sprawdź i dodaj disappearing_messages_enabled_at
SET @columnname = 'disappearing_messages_enabled_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATETIME NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Sprawdź i dodaj disappearing_messages_enabled_by
SET @columnname = 'disappearing_messages_enabled_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Dodaj foreign key constraint (jeśli nie istnieje)
SET @constraintname = 'fk_conversation_disappearing_enabled_by';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (constraint_name = @constraintname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT ', @constraintname, ' FOREIGN KEY (disappearing_messages_enabled_by) REFERENCES users(user_id) ON DELETE SET NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 3. DODANIE KOLUMNY DO TABELI users
-- ============================================

SET @tablename = 'users';
SET @columnname = 'default_disappearing_time';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' INT NOT NULL DEFAULT 60')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 4. DODANIE KOLUMNY DO TABELI message_read_status
-- ============================================

SET @tablename = 'message_read_status';
SET @columnname = 'delete_at';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' DATETIME NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ============================================
-- 5. SPRAWDZENIE STRUKTURY PO AKTUALIZACJI
-- ============================================

SELECT '=== STRUKTURA PO AKTUALIZACJI ===' AS info;

SELECT 'conversations' AS tabela;
DESCRIBE conversations;

SELECT 'users' AS tabela;
DESCRIBE users;

SELECT 'message_read_status' AS tabela;
DESCRIBE message_read_status;
