const pool = require('../config/db');

class UserRepository {
    async findById(id) {
        const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return res.rows[0];
    }

    async findByUsername(username) {
        const res = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        return res.rows[0];
    }

    // Основний метод для реєстрації
    async createWithPassword(username, passwordHash) {
        const res = await pool.query(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
            [username, passwordHash]
        );
        return res.rows[0];
    }

    // Для сумісності з іншими частинами коду
    async getAllUsers() {
        const res = await pool.query('SELECT id, username, theme, avatar_url FROM users');
        return res.rows;
    }

    async updateTheme(userId, theme) {
        await pool.query('UPDATE users SET theme = $1 WHERE id = $2', [theme, userId]);
    }

    async getActiveChats(userId) {
        const query = `
            SELECT DISTINCT u.id, u.username, u.avatar_url 
            FROM users u
            JOIN messages m ON (u.id = m.sender_id OR u.id = m.receiver_id)
            WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND u.id != $1
        `;
        const res = await pool.query(query, [userId]);
        return res.rows;
    }
}

module.exports = new UserRepository();