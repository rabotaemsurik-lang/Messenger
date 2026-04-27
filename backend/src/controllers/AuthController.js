const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../models/UserRepository');

// Секретний ключ для підпису токенів (в ідеалі має бути в .env)
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_messenger_key';

const AuthController = {
    async register(req, res) {
        try {
            const { username, password } = req.body;

            // [Principle: Fail Fast] - миттєва перевірка
            if (!username || !password) {
                return res.status(400).json({ error: "Заповніть всі поля" });
            }

            const existingUser = await userRepository.findByUsername(username);
            if (existingUser) {
                return res.status(400).json({ error: "Користувач вже існує" });
            }

            // Хешуємо пароль (Refactoring: Extract Method у перспективі)
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const newUser = await userRepository.createWithPassword(username, passwordHash);

            // Генеруємо токен
            const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ user: newUser, token });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async login(req, res) {
        try {
            const { username, password } = req.body;
            const user = await userRepository.findByUsername(username);

            if (!user) return res.status(404).json({ error: "Користувача не знайдено" });

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) return res.status(400).json({ error: "Невірний пароль" });

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ user, token });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // Перевірка токену при оновленні сторінки
    async getMe(req, res) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ error: "Немає токену" });

            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await userRepository.findById(decoded.id);
            res.json({ user });
        } catch (error) {
            res.status(401).json({ error: "Недійсний токен" });
        }
    }
};

module.exports = AuthController;