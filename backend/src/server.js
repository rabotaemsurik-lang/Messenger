const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const pool = require('./config/db');

const chatService = require('./services/ChatService');
const groupService = require('./services/GroupService');
const userRepository = require('./models/UserRepository');
const messageRepository = require('./models/MessageRepository');
const groupRepo = require('./models/GroupRepository');

const AuthController = require('./controllers/AuthController');
const { registerSocketHandlers } = require('./sockets/registerSocketHandlers');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', AuthController.getMe);

app.get('/api/users/chats', async (req, res) => {
    try {
        const { userId } = req.query;
        const chats = await userRepository.getActiveChats(userId);
        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users/groups', async (req, res) => {
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

app.get('/api/messages/history', async (req, res) => {
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

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await userRepository.findById(req.params.id);
        if (!user) return res.status(404).json({ error: "Юзера не знайдено" });
        const { password_hash, ...publicProfile } = user;
        res.json(publicProfile);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/profile', async (req, res) => {
    try {
        const { userId, bio, birthday, avatar_url } = req.body;
        const updatedUser = await userRepository.updateProfile(userId, { bio, birthday, avatar_url });
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

registerSocketHandlers(io, {
    pool,
    chatService,
    groupService,
    userRepository,
    groupRepo,
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
