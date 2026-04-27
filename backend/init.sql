CREATE TABLE IF NOT EXISTS users (
                                     id SERIAL PRIMARY KEY,
                                     username VARCHAR(50) UNIQUE NOT NULL,
    theme VARCHAR(20) DEFAULT 'light'
    );

CREATE TABLE IF NOT EXISTS messages (
                                        id SERIAL PRIMARY KEY,
                                        sender_id INTEGER REFERENCES users(id),
    receiver_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
-- Оновлюємо таблицю користувачів
ALTER TABLE users
    ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN avatar_url TEXT,
ADD COLUMN font_size INTEGER DEFAULT 16,
ADD COLUMN my_msg_color VARCHAR(20) DEFAULT '#007bff',
ADD COLUMN their_msg_color VARCHAR(20) DEFAULT '#e9ecef',
ADD COLUMN last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Оновлюємо таблицю повідомлень
ALTER TABLE messages
    ADD COLUMN is_read BOOLEAN DEFAULT FALSE,
ADD COLUMN media_url TEXT;


ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);



-- Переконуємось, що ми в потрібній базі (messenger_db)
-- Додаємо колонку, якщо її ще немає, і робимо її доступною для AuthController
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='password_hash') THEN
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
END IF;
END $$;

-- Також перевір інші колонки, які використовує твій проект
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP;



TRUNCATE TABLE messages CASCADE;
TRUNCATE TABLE users CASCADE;








-- 1. Видаляємо старе, щоб почати з чистого аркуша
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Створюємо таблицю користувачів з УСІМА колонками відразу
CREATE TABLE users (
                       id SERIAL PRIMARY KEY,
                       username VARCHAR(50) UNIQUE NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       theme VARCHAR(20) DEFAULT 'light',
                       avatar_url TEXT,
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

-- Перевірка: цей запит має показати колонку password_hash
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users';