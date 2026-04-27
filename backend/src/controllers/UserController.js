const userRepository = require('../models/UserRepository');
const messageRepository = require('../models/MessageRepository');

// [SOLID: OCP (Open/Closed Principle)] - можемо додавати нові методи без зміни існуючих.
const UserController = {
    async getAllUsers(req, res) {
        try {
            const users = await userRepository.getAllUsers();
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getHistory(req, res) {
        try {
            const { user1, user2 } = req.query;
            const history = await messageRepository.getChatHistory(user1, user2);
            res.json(history);
        } catch (error) {
            // [Refactoring: Inline Function] - проста обробка помилки в один рядок
            res.status(500).json({ error: "Failed to fetch history" });
        }
    }
};

module.exports = UserController;