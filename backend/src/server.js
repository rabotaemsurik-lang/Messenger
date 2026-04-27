const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const pool = require('./config/db');

// Імпорт сервісів та репозиторіїв
const chatService = require('./services/ChatService');
const groupService = require('./services/GroupService');
const userRepository = require('./models/UserRepository');
const messageRepository = require('./models/MessageRepository');
const groupRepo = require('./models/GroupRepository');

// Імпорт контролерів
const AuthController = require('./controllers/AuthController');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// --- API МАРШРУТИ ---
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', AuthController.getMe);

// Отримання приватних чатів
app.get('/api/users/chats', async (req, res) => {
    try {
        const { userId } = req.query;
        const chats = await userRepository.getActiveChats(userId);
        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Отримання списку груп користувача (Критично для збереження груп після оновлення!)
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

// Отримання історії (Універсальне: для юзера або групи)
app.get('/api/messages/history', async (req, res) => {
    try {
        const { user1, user2, groupId } = req.query;
        let history;

        if (groupId) {
            // Історія групи
            const result = await pool.query(`
                SELECT m.*, u.username as sender_name 
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.group_id = $1 
                ORDER BY m.created_at ASC
            `, [groupId]);
            history = result.rows;
        } else {
            // Історія приватного чату
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

// --- СЕРВЕР ТА SOCKET.IO ---
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const activeSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('Нове підключення:', socket.id);

    socket.on('register', async (username) => {
        try {
            if (!username) return socket.emit('error_msg', 'Username обов’язковий');
            const user = await userRepository.findByUsername(username);
            if (!user) return socket.emit('error_msg', 'Користувача не знайдено');

            socket.userId = user.id;
            socket.username = user.username;
            activeSockets.set(user.id, socket.id);
            socket.emit('auth_success', { user, status: 'login' });
        } catch (err) {
            socket.emit('error_msg', 'Помилка авторизації');
        }
    });

    socket.on('send_message', async (data) => {
        const { receiverId, text } = data;
        try {
            const savedMsg = await chatService.saveAndBroadcastMessage(socket.userId, receiverId, text);
            if (savedMsg) {
                const receiverSocket = activeSockets.get(receiverId);
                const emitData = { ...savedMsg, sender_name: socket.username };
                socket.emit('receive_message', emitData);
                if (receiverSocket) {
                    io.to(receiverSocket).emit('receive_message', emitData);
                    io.to(receiverSocket).emit('users_updated');
                }
            }
        } catch (err) {
            socket.emit('error_msg', 'Помилка відправки');
        }
    });

    socket.on('send_group_message', async ({ groupId, text }) => {
        try {
            await groupService.sendMessageToGroup(groupId, socket.userId, text, io, activeSockets);
        } catch (err) {
            socket.emit('error_msg', 'Помилка групового повідомлення');
        }
    });

    socket.on('create_group', async ({ name, creatorId, initialMemberName }) => {
        try {
            const newGroup = await groupRepo.createGroupWithMember(name, creatorId, initialMemberName);
            socket.emit('group_created', newGroup);

            const invitedUser = await userRepository.findByUsername(initialMemberName);
            if (invitedUser) {
                const invitedSocket = activeSockets.get(invitedUser.id);
                if (invitedSocket) io.to(invitedSocket).emit('group_created', newGroup);
            }
        } catch (err) {
            socket.emit('error_msg', err.message || 'Не вдалося створити групу');
        }
    });

    socket.on('add_to_group', async ({ groupId, username }) => {
        try {
            const userToAdd = await userRepository.findByUsername(username);
            if (!userToAdd) return socket.emit('error_msg', 'Користувача не знайдено');

            const alreadyMember = await groupRepo.isMember(groupId, userToAdd.id);
            if (alreadyMember) return socket.emit('error_msg', 'Він вже у групі');

            await groupRepo.addMember(groupId, userToAdd.id);

            const targetSocket = activeSockets.get(userToAdd.id);
            if (targetSocket) {
                const groupInfo = await pool.query('SELECT * FROM groups WHERE id = $1', [groupId]);
                io.to(targetSocket).emit('group_created', groupInfo.rows[0]);
            }
            socket.emit('success_msg', 'Користувача додано');
        } catch (err) {
            socket.emit('error_msg', 'Помилка при додаванні');
        }
    });

    socket.on('delete_chat', async ({ groupId, receiverId }) => {
        try {
            if (groupId) {
                // Вихід з групи (це ми вже зробили)
                await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, socket.userId]);
                await groupRepo.deleteGroupIfEmpty(groupId);
            } else if (receiverId) {
                // Видалення особистих повідомлень (SOLID: для обох сторін або тільки для себе)
                // Видалимо повідомлення, де я відправник або отримувач у цьому діалозі
                await pool.query(`
                DELETE FROM messages 
                WHERE (sender_id = $1 AND receiver_id = $2) 
                   OR (sender_id = $2 AND receiver_id = $1)
            `, [socket.userId, receiverId]);
            }
            socket.emit('users_updated');
        } catch (err) {
            socket.emit('error_msg', 'Помилка видалення');
        }
    });

    socket.on('add_chat', async (targetUsername) => {
        try {
            const targetUser = await userRepository.findByUsername(targetUsername);
            if (!targetUser) return socket.emit('error_msg', `Користувача "${targetUsername}" не знайдено`);
            if (targetUser.id === socket.userId) return socket.emit('error_msg', 'Це ви');
            socket.emit('chat_added', targetUser);
        } catch (err) {
            socket.emit('error_msg', 'Помилка пошуку');
        }
    });

    socket.on('update_theme', async ({ theme }) => {
        if (socket.userId) await userRepository.updateTheme(socket.userId, theme);
    });

    socket.on('disconnect', () => {
        if (socket.userId) activeSockets.delete(socket.userId);
    });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));