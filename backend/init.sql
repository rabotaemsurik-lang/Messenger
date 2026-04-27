-- 1. Видаляємо все старе
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Створюємо таблицю користувачів з УСІМА полями відразу
CREATE TABLE users (
                       id SERIAL PRIMARY KEY,
                       username VARCHAR(50) UNIQUE NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       theme VARCHAR(20) DEFAULT 'light',
                       avatar_url TEXT,
                       bio TEXT,
                       birthday DATE,
                       font_size INTEGER DEFAULT 16,
                       my_msg_color VARCHAR(20) DEFAULT '#007bff',
                       their_msg_color VARCHAR(20) DEFAULT '#e9ecef',
                       last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Створюємо таблицю повідомлень
CREATE TABLE messages (
                          id SERIAL PRIMARY KEY,
                          sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                          receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                          content TEXT NOT NULL,
                          is_read BOOLEAN DEFAULT FALSE,
                          media_url TEXT,
                          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE groups (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        avatar_url TEXT,
                        creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
                               group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
                               user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                               joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                               PRIMARY KEY (group_id, user_id)
);

-- Додаємо колонку group_id в таблицю повідомлень
ALTER TABLE messages ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE;
-- Тепер повідомлення може мати АБО receiver_id (особисте), АБО group_id (групове)