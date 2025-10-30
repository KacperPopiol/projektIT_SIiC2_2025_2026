# Projekt IT - Aplikacja Chat

Aplikacja czatu w czasie rzeczywistym zbudowana z wykorzystaniem React, Express.js, MySQL i Socket.io.

## Instalacja

### 1. Pobierz projekt

**Opcja A: Pobierz ZIP**
- Pobierz repozytorium jako ZIP z GitHuba
- Rozpakuj archiwum w wybranej lokalizacji

**Opcja B: Klonowanie przez Git**


git clone https://github.com/KacperPopiol/projektIT_SIiC2_2025_2026.git
cd projektIT_SIiC2_2025_2026


### 2. Instalacja zależności

Zainstaluj pakiety npm w obu folderach projektu:

**Backend:**


cd chat-app
npm install


**Frontend:**

cd chat-app-frontend
npm install


### 3. Konfiguracja bazy danych

**Edycja pliku .env:**
- Otwórz plik `.env` w folderze `chat-app`
- Zmień `DB_PASSWORD` na hasło Twojego roota MySQL
- Opcjonalnie dostosuj nazwę bazy danych w `DB_NAME`



**Przygotowanie bazy:**
- Uruchom serwer MySQL
- Jeśli baza `chat_app_db` istnieje, usuń ją i stwórz od nowa pustą.
- Jeśli nie istnieje, stwórz od nowa pustą.

## Uruchomienie aplikacji

### 4. Uruchom backend

Przejdź do folderu serwera i uruchom aplikację:


cd chat-app
npm run dev


### 5. Uruchom frontend

W nowym terminalu przejdź do folderu frontend:

cd chat-app-frontend
npm run dev