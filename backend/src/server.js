const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const chatService = require('./services/ChatService');
const userRepository = require('./models/UserRepository');
const messageRepository = require('./models/MessageRepository');

// 1. Імпортуємо контролер тут:
const AuthController = require('./controllers/AuthController');

// 2. СТВОРЮЄМО app! (Це має бути ДО твоїх маршрутів)
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// 3. І ТІЛЬКИ ТЕПЕР додаємо всі маршрути (бо app вже існує):
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', AuthController.getMe);

// Ендпоінти для API
app.get('/api/users/chats', async (req, res) => {
    try {
        const { userId } = req.query;
        // [Pattern: Repository] — Отримуємо лише активні чати користувача
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

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const activeSockets = new Map(); // userId -> socketId

// [Pattern: Observer] — Обробка подій через WebSockets
io.on('connection', (socket) => {

    // --- АВТОРИЗАЦІЯ ---
// В server.js всередині io.on('connection')
    socket.on('register', async (username) => {
        try {
            if (!username) return socket.emit('error_msg', 'Username обов’язковий');

            const user = await userRepository.findByUsername(username);

            if (!user) {
                // Якщо юзера немає, ми не створюємо його тут!
                // Він мав зареєструватися через форму.
                return socket.emit('error_msg', 'Користувача не знайдено. Будь ласка, зареєструйтесь.');
            }

            socket.userId = user.id;
            socket.username = user.username;
            activeSockets.set(user.id, socket.id);

            socket.emit('auth_success', { user, status: 'login' });
        } catch (err) {
            socket.emit('error_msg', 'Помилка авторизації в сокетах');
        }
    });

    // --- ДОДАВАННЯ ЧАТУ (ПОШУК ЮЗЕРА) ---
    socket.on('add_chat', async (targetUsername) => {
        console.log(`Користувач ${socket.username} шукає: ${targetUsername}`); // Додай це!
        try {
            const targetUser = await userRepository.findByUsername(targetUsername);

            if (!targetUser) {
                // [Principle: Error Handling] — Повідомляємо, якщо юзера не існує
                return socket.emit('error_msg', `Користувача "${targetUsername}" не знайдено`);
            }

            if (targetUser.id === socket.userId) {
                return socket.emit('error_msg', 'Ви не можете додати себе в чат');
            }

            // Повертаємо дані знайденого юзера для відкриття чату на фронті
            socket.emit('chat_added', targetUser);
        } catch (err) {
            socket.emit('error_msg', 'Помилка при пошуку користувача');
        }
    });

    // --- НАДІСЛАННЯ ПОВІДОМЛЕННЯ ---
    socket.on('send_message', async (data) => {
        const { receiverId, text } = data;

        try {
            // [SOLID: SRP] — Збереження логіки повідомлень у ChatService
            const savedMsg = await chatService.saveAndBroadcastMessage(socket.userId, receiverId, text);

            if (savedMsg) {
                const receiverSocket = activeSockets.get(receiverId);
                const emitData = { ...savedMsg, sender_name: socket.username };

                // Відправляємо обом (відправнику та отримувачу)
                socket.emit('receive_message', emitData);

                if (receiverSocket) {
                    io.to(receiverSocket).emit('receive_message', emitData);
                    // Оновлюємо список чатів у отримувача, якщо це був перший контакт
                    io.to(receiverSocket).emit('users_updated');
                }
            }
        } catch (err) {
            socket.emit('error_msg', 'Не вдалося надіслати повідомлення');
        }
    });

    // --- ТЕМИ ТА НАЛАШТУВАННЯ ---
    socket.on('update_theme', async ({ theme }) => {
        if (socket.userId) {
            await userRepository.updateTheme(socket.userId, theme);
        }
    });

    socket.on('disconnect', () => {
        if (socket.userId) activeSockets.delete(socket.userId);
    });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));