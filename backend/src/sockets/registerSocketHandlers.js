function registerSocketHandlers(io, deps) {
    const {
        pool,
        chatService,
        groupService,
        userRepository,
        groupRepo,
    } = deps;

    const activeSockets = new Map();

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
                    await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, socket.userId]);
                    await groupRepo.deleteGroupIfEmpty(groupId);
                } else if (receiverId) {
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

    return { activeSockets };
}

module.exports = { registerSocketHandlers };
