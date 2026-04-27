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
    // backend/src/models/GroupRepository.js

    async isMember(groupId, userId) {
        const res = await pool.query(
            'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, userId]
        );
        return res.rows.length > 0;
    }

    async addMember(groupId, userId) {
        return await pool.query(
            'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [groupId, userId]
        );
    }

    async removeMember(groupId, userId) {
        return await pool.query(
            'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
            [groupId, userId]
        );
    }

    async deleteGroupIfEmpty(groupId) {
        const res = await pool.query('SELECT COUNT(*) FROM group_members WHERE group_id = $1', [groupId]);
        if (parseInt(res.rows[0].count) === 0) {
            await pool.query('DELETE FROM groups WHERE id = $1', [groupId]);
        }
    }
    async createGroupWithMember(name, creatorId, memberUsername) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Знаходимо ID запрошеного юзера
            const userRes = await client.query('SELECT id FROM users WHERE username = $1', [memberUsername]);
            if (userRes.rows.length === 0) throw new Error("Користувача не знайдено");
            const invitedId = userRes.rows[0].id;

            // 2. Створюємо групу
            const groupRes = await client.query(
                'INSERT INTO groups (name, creator_id) VALUES ($1, $2) RETURNING *',
                [name, creatorId]
            );
            const group = groupRes.rows[0];

            // 3. Додаємо обох учасників
            await client.query(
                'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2), ($1, $3)',
                [group.id, creatorId, invitedId]
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
}

module.exports = new GroupRepository();