const { Pool } = require('pg');
require('dotenv').config();

// [Pattern: Singleton]
const pool = new Pool({
    // У Docker використовуємо ім'я сервісу 'db' замість 'localhost'
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'rootpassword',
    database: process.env.DB_NAME || 'messenger_db',
    port: process.env.DB_PORT || 5432,
});

// Перевірка з'єднання при старті
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;