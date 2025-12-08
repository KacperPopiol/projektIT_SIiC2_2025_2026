# Archiwizacja Konwersacji Grupowych - Instrukcja Aktualizacji

## Opis zmian

Ta aktualizacja dodaje funkcjonalność archiwizacji konwersacji grupowych, która działa analogicznie do archiwizacji konwersacji prywatnych.

### Zmiany w bazie danych

Do tabeli `group_members` dodano dwa nowe pola:
- `is_archived` (BOOLEAN, domyślnie FALSE) - flaga określająca czy konwersacja grupowa jest zarchiwizowana dla użytkownika
- `archived_at` (DATETIME, nullable) - data i czas archiwizacji konwersacji

### Zmiany w kodzie

1. **Model `GroupMember.js`**
   - Dodano pola `is_archived` i `archived_at`

2. **Controller `messageController.js`**
   - `getConversations()` - zaktualizowano aby filtrowała konwersacje grupowe według parametru `includeArchived`
   - `archiveConversation()` - rozszerzono o obsługę konwersacji grupowych
   - `unarchiveConversation()` - rozszerzono o obsługę konwersacji grupowych

## Instrukcja instalacji

### 1. Aktualizacja bazy danych

Wykonaj skrypt SQL, aby dodać nowe kolumny do tabeli `group_members`:

```bash
# W katalogu chat-app wykonaj:
mysql -u [username] -p [database_name] < update_db_group_archive.sql
```

Lub zaloguj się do MySQL i wykonaj:

```sql
source update_db_group_archive.sql
```

### 2. Weryfikacja zmian

Po wykonaniu skryptu sprawdź strukturę tabeli:

```sql
DESCRIBE group_members;
```

Powinieneś zobaczyć nowe kolumny:
- `is_archived` - tinyint(1), default 0
- `archived_at` - datetime, nullable

### 3. Restart serwera

Po aktualizacji bazy danych zrestartuj serwer Node.js:

```bash
# Zatrzymaj serwer (Ctrl+C)
# Uruchom ponownie
npm start
```

## Testowanie

### Archiwizacja konwersacji grupowej

```bash
# Endpoint: POST /api/messages/conversations/:conversationId/archive
curl -X POST http://localhost:5000/api/messages/conversations/123/archive \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Przywracanie konwersacji grupowej z archiwum

```bash
# Endpoint: POST /api/messages/conversations/:conversationId/unarchive
curl -X POST http://localhost:5000/api/messages/conversations/123/unarchive \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Pobieranie konwersacji

```bash
# Aktywne konwersacje (bez zarchiwizowanych)
curl http://localhost:5000/api/messages/conversations?includeArchived=false \
  -H "Authorization: Bearer YOUR_TOKEN"

# Wszystkie konwersacje (włącznie z zarchiwizowanymi)
curl http://localhost:5000/api/messages/conversations?includeArchived=true \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Struktura odpowiedzi API

Struktura odpowiedzi z `getConversations()` pozostaje bez zmian:

```json
{
  "success": true,
  "privateConversations": [
    {
      "conversation_id": 1,
      "is_archived": false,
      "archived_at": null,
      "conversation": { ... }
    }
  ],
  "groupConversations": [
    {
      "member_id": 1,
      "group_id": 1,
      "user_id": 1,
      "status": "accepted",
      "is_archived": false,
      "archived_at": null,
      "group": {
        "group_id": 1,
        "group_name": "Moja grupa",
        "conversation": { ... }
      }
    }
  ]
}
```

## Zgodność wsteczna

- ✅ Istniejące konwersacje grupowe otrzymają automatycznie wartość `is_archived = FALSE`
- ✅ Frontend będzie działał bez zmian, ponieważ struktura odpowiedzi API pozostaje taka sama
- ✅ Wszystkie istniejące funkcje zachowują swoją funkcjonalność

## Uwagi

- Archiwizacja jest indywidualna dla każdego użytkownika (per-user basis)
- Zarchiwizowanie konwersacji grupowej przez jednego użytkownika nie wpływa na innych członków grupy
- Wiadomości w zarchiwizowanych konwersacjach nadal są dostępne po przywróceniu z archiwum

## Troubleshooting

### Problem: Kolumny już istnieją
Jeśli otrzymasz komunikat, że kolumny już istnieją, skrypt SQL automatycznie pominie ich tworzenie.

### Problem: Brak uprawnień
Upewnij się, że użytkownik MySQL ma uprawnienia ALTER TABLE:

```sql
GRANT ALTER ON database_name.* TO 'username'@'localhost';
FLUSH PRIVILEGES;
```

### Problem: Błędy na frontendzie
Wyczyść cache przeglądarki i upewnij się, że struktura danych zwracana przez API jest zgodna z oczekiwaniami frontendu.

## Data aktualizacji

2025-01-XX (dostosuj do aktualnej daty)

## Autor

Zespół projektowy IT_SIiC2_2025_2026