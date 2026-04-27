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

app.get('/api/users/chats', async (req, res) => {
    try {
        const { userId } = req.query;
        const chats = await userRepository.getActiveChats(userId);
        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/messages/history', async (req, res) => {
    try {
        const { user1, user2 } = req.query;
        const history = await messageRepository.getChatHistory(user1, user2);
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

    // 1. АВТОРИЗАЦІЯ В СОКЕТАХ
    socket.on('register', async (username) => {
        try {
            if (!username) return socket.emit('error_msg', 'Username обов’язковий');
            const user = await userRepository.findByUsername(username);

            if (!user) {
                return socket.emit('error_msg', 'Користувача не знайдено');
            }

            socket.userId = user.id;
            socket.username = user.username;
            activeSockets.set(user.id, socket.id);

            socket.emit('auth_success', { user, status: 'login' });
        } catch (err) {
            socket.emit('error_msg', 'Помилка авторизації');
        }
    });

    // 2. ПРИВАТНІ ПОВІДОМЛЕННЯ
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
            socket.emit('error_msg', 'Не вдалося надіслати повідомлення');
        }
    });

    // 3. ГРУПОВІ ПОВІДОМЛЕННЯ
    socket.on('send_group_message', async ({ groupId, text }) => {
        try {
            // [SOLID: Dependency Inversion] — Використовуємо сервіс для логіки розсилки
            await groupService.sendMessageToGroup(
                groupId,
                socket.userId,
                text,
                io,
                activeSockets
            );
        } catch (err) {
            console.error("Помилка групи:", err);
            socket.emit('error_msg', 'Помилка групового повідомлення');
        }
    });

    // 4. СТВОРЕННЯ ГРУПИ
    socket.on('create_group', async ({ name, creatorId, initialMemberName }) => {
        try {
            const newGroup = await groupRepo.createGroupWithMember(name, creatorId, initialMemberName);

            // Повідомляємо творця
            socket.emit('group_created', newGroup);

            // Повідомляємо запрошеного (якщо він онлайн)
            const invitedUser = await userRepository.findByUsername(initialMemberName);
            const invitedSocket = activeSockets.get(invitedUser.id);
            if (invitedSocket) {
                io.to(invitedSocket).emit('group_created', newGroup);
            }
        } catch (err) {
            socket.emit('error_msg', err.message || 'Не вдалося створити групу');
        }
    });

    // 5. ПОШУК КОРИСТУВАЧА
    socket.on('add_chat', async (targetUsername) => {
        try {
            const targetUser = await userRepository.findByUsername(targetUsername);
            if (!targetUser) {
                return socket.emit('error_msg', `Користувача "${targetUsername}" не знайдено`);
            }
            if (targetUser.id === socket.userId) {
                return socket.emit('error_msg', 'Ви не можете додати себе');
            }
            socket.emit('chat_added', targetUser);
        } catch (err) {
            socket.emit('error_msg', 'Помилка при пошуку');
        }
    });

    // 6. ІНШІ ПОДІЇ
    socket.on('update_theme', async ({ theme }) => {
        if (socket.userId) {
            await userRepository.updateTheme(socket.userId, theme);
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId) {
            activeSockets.delete(socket.userId);
            console.log(`Користувач ${socket.username} відключився`);
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));