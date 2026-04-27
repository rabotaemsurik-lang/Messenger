const pool = require('../config/db');

class MessageRepository {
    async saveMessage(senderId, receiverId, content) {
        const res = await pool.query(
            'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
            [senderId, receiverId, content]
        );
        return res.rows[0];
    }
    async saveGroupMessage(senderId, groupId, content) {
        const res = await pool.query(
            'INSERT INTO messages (sender_id, group_id, content) VALUES ($1, $2, $3) RETURNING *',
            [senderId, groupId, content]
        );
        return res.rows[0];
    }
    async getChatHistory(user1Id, user2Id) {
        const res = await pool.query(
            `SELECT m.*, u1.username as sender_name 
             FROM messages m 
             JOIN users u1 ON m.sender_id = u1.id
             WHERE (m.sender_id = $1 AND m.receiver_id = $2) 
                OR (m.sender_id = $2 AND m.receiver_id = $1)
             ORDER BY m.created_at ASC`,
            [user1Id, user2Id]
        );
        return res.rows;
    }
}

module.exports = new MessageRepository();