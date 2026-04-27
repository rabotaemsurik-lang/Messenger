// [SOLID: DIP (Dependency Inversion Principle)] - Сервіс залежить від репозиторіїв (абстракцій доступу до даних), а не від прямого SQL.
const userRepository = require('../models/UserRepository');
const messageRepository = require('../models/MessageRepository');

class ChatService {
    async handleConnection(username) {
        // [Principle: Fail Fast] - миттєва перевірка на валідне ім'я
        if (!username) throw new Error("Username is required");
        return await userRepository.createOrGetUser(username);
    }

    async saveAndBroadcastMessage(senderId, receiverId, text) {
        // [Refactoring: Extract Variable] - виділення умови у змінну для кращої читабельності
        const isMessageValid = text !== null && text.trim() !== '';
        if (!isMessageValid) return null;

        // [Pattern: Factory (спрощений)] - сервіс "збирає" об'єкт повідомлення перед збереженням
        return await messageRepository.saveMessage(senderId, receiverId, text);
    }
}

module.exports = new ChatService();