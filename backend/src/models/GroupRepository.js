const pool = require('../config/db');

class GroupRepository {
    async createGroup(name, creatorId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Створюємо групу
            const groupRes = await client.query(
                'INSERT INTO groups (name, creator_id) VALUES ($1, $2) RETURNING *',
                [name, creatorId]
            );
            const group = groupRes.rows[0];
            // 2. Додаємо творця як першого учасника
            await client.query(
                'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
                [group.id, creatorId]
            );
            await client.query('COMMIT');
            return group;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    async getGroupsByUserId(userId) {
        const res = await pool.query(
            `SELECT g.* FROM groups g 
             JOIN group_members gm ON g.id = gm.group_id 
             WHERE gm.user_id = $1`, [userId]
        );
        return res.rows;
    }

    async addMember(groupId, userId) {
        await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, userId]);
    }
}

module.exports = new GroupRepository();