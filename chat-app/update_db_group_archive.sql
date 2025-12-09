-- Skrypt SQL do dodania kolumn archiwizacji do tabeli group_members
-- Ten skrypt dodaje pola is_archived i archived_at, które umożliwiają archiwizację konwersacji grupowych

-- Dodaj kolumnę is_archived jeśli nie istnieje
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'group_members'
    AND COLUMN_NAME = 'is_archived'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE group_members ADD COLUMN is_archived BOOLEAN DEFAULT FALSE',
    'SELECT "Kolumna is_archived już istnieje w tabeli group_members" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Dodaj kolumnę archived_at jeśli nie istnieje
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'group_members'
    AND COLUMN_NAME = 'archived_at'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE group_members ADD COLUMN archived_at DATETIME NULL',
    'SELECT "Kolumna archived_at już istnieje w tabeli group_members" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Komunikat końcowy
SELECT 'Aktualizacja tabeli group_members zakończona pomyślnie!' AS message;

-- Dodatkowe informacje
SELECT
    'is_archived' AS kolumna,
    'BOOLEAN' AS typ,
    'FALSE' AS wartosc_domyslna,
    'Flaga określająca czy konwersacja grupowa jest zarchiwizowana dla użytkownika' AS opis
UNION ALL
SELECT
    'archived_at' AS kolumna,
    'DATETIME' AS typ,
    'NULL' AS wartosc_domyslna,
    'Data i czas archiwizacji konwersacji grupowej' AS opis;
