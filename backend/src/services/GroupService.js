const groupRepo = require('../models/GroupRepository');
const messageRepo = require('../models/MessageRepository');
const pool = require('../config/db');

class GroupService {
    async sendMessageToGroup(groupId, senderId, text, io, userSockets) {
        // 1. Зберігаємо в БД
        const savedMsg = await messageRepo.saveGroupMessage(senderId, groupId, text);

        // 2. Отримуємо учасників
        const res = await pool.query('SELECT user_id FROM group_members WHERE group_id = $1', [groupId]);

        // 3. Розсилаємо всім онлайн-учасникам
        res.rows.forEach(member => {
            const socketId = userSockets.get(member.user_id);
            if (socketId) {
                io.to(socketId).emit('receive_message', savedMsg);
            }
        });

        return savedMsg;
    }
}
module.exports = new GroupService();