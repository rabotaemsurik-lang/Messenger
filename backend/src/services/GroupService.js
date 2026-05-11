const groupRepo = require('../models/GroupRepository');
const messageRepo = require('../models/MessageRepository');

class GroupService {
    async sendMessageToGroup(groupId, senderId, text, io, userSockets) {
        const savedMsg = await messageRepo.saveGroupMessage(senderId, groupId, text);
        const memberIds = await groupRepo.getMemberUserIds(groupId);
        memberIds.forEach((userId) => {
            const socketId = userSockets.get(userId);
            if (socketId) {
                io.to(socketId).emit('receive_message', savedMsg);
            }
        });
        return savedMsg;
    }
}
module.exports = new GroupService();
