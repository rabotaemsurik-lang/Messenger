const express = require('express');

function createApiRoutes({ AuthController, pool, userRepository, messageRepository }) {
    const router = express.Router();

    router.post('/auth/register', AuthController.register);
    router.post('/auth/login', AuthController.login);
    router.get('/auth/me', AuthController.getMe);

    router.get('/users/chats', async (req, res) => {
        try {
            const { userId } = req.query;
            const chats = await userRepository.getActiveChats(userId);
            res.json(chats);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/users/groups', async (req, res) => {
        try {
            const { userId } = req.query;
            const groups = await pool.query(`
            SELECT g.* FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_id = $1
        `, [userId]);
            res.json(groups.rows);
        } catch (err) {
            res.status(500).json({ error: "Не вдалося завантажити групи" });
        }
    });

    router.get('/messages/history', async (req, res) => {
        try {
            const { user1, user2, groupId } = req.query;
            let history;

            if (groupId) {
                const result = await pool.query(`
                SELECT m.*, u.username as sender_name 
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.group_id = $1 
                ORDER BY m.created_at ASC
            `, [groupId]);
                history = result.rows;
            } else {
                history = await messageRepository.getChatHistory(user1, user2);
            }
            res.json(history);
        } catch (err) {
            res.status(500).json({ error: "Не вдалося завантажити історію" });
        }
    });

    router.get('/users/:id', async (req, res) => {
        try {
            const user = await userRepository.findById(req.params.id);
            if (!user) return res.status(404).json({ error: "Юзера не знайдено" });
            const { password_hash, ...publicProfile } = user;
            res.json(publicProfile);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/users/profile', async (req, res) => {
        try {
            const { userId, bio, birthday, avatar_url } = req.body;
            const updatedUser = await userRepository.updateProfile(userId, { bio, birthday, avatar_url });
            res.json(updatedUser);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
}

module.exports = { createApiRoutes };
