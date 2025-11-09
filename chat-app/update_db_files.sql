-- ============================================
-- MIGRACJA BAZY DANYCH - TABELA FILES
-- ============================================
-- Ten skrypt dodaje tabelę files do bazy danych
-- dla funkcjonalności przesyłania plików
--
-- INSTRUKCJA URUCHOMIENIA:
-- 1. Upewnij się, że masz połączenie z bazą danych
-- 2. Uruchom ten skrypt w MySQL Workbench
-- ============================================

USE chat_app_db;

-- Sprawdź czy tabela już istnieje
SET @table_exists = (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'chat_app_db' 
    AND table_name = 'files'
);

-- Utwórz tabelę tylko jeśli nie istnieje
SET @sql = IF(@table_exists = 0,
    'CREATE TABLE files (
        file_id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NULL,
        original_name VARCHAR(500) NOT NULL,
        stored_name VARCHAR(500) NOT NULL UNIQUE,
        file_path VARCHAR(1000) NOT NULL,
        file_type VARCHAR(100) NOT NULL COMMENT "MIME type (e.g., image/jpeg, application/pdf)",
        file_size BIGINT NOT NULL COMMENT "Rozmiar pliku w bajtach",
        mime_category ENUM("image", "video", "document", "pdf", "audio") NOT NULL COMMENT "Kategoria pliku",
        thumbnail_path VARCHAR(1000) NULL COMMENT "Ścieżka do miniatury (tylko dla obrazów)",
        is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_message_id (message_id),
        INDEX idx_mime_category (mime_category),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_file_message FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    'SELECT "Tabela files już istnieje" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Sprawdź czy kolumna thumbnail_path istnieje (na wypadek częściowej migracji)
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = 'chat_app_db' 
    AND table_name = 'files' 
    AND column_name = 'thumbnail_path'
);

-- Dodaj kolumnę thumbnail_path jeśli nie istnieje
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE files ADD COLUMN thumbnail_path VARCHAR(1000) NULL COMMENT "Ścieżka do miniatury (tylko dla obrazów)" AFTER mime_category;',
    'SELECT "Kolumna thumbnail_path już istnieje" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Sprawdź czy kolumna message_id jest NULL (jeśli tabela już istnieje, zmień na NULL)
SET @message_id_nullable = (
    SELECT IS_NULLABLE 
    FROM information_schema.columns 
    WHERE table_schema = 'chat_app_db' 
    AND table_name = 'files' 
    AND column_name = 'message_id'
);

-- Jeśli kolumna jest NOT NULL, zmień na NULL
SET @sql = IF(@message_id_nullable = 'NO',
    'ALTER TABLE files MODIFY COLUMN message_id INT NULL;',
    'SELECT "Kolumna message_id już jest NULL" AS message;'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ Migracja zakończona pomyślnie!' AS status;

