import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// [Principle: Separation of Concerns (SoC)] - відділяємо логіку сокетів від UI компонентів.
export const useChatWebSocket = (username, fetchUsersCallback) => {
    const socketRef = useRef(null);
    const [incomingMessage, setIncomingMessage] = useState(null);
    const [currentUserInfo, setCurrentUserInfo] = useState(null);

    useEffect(() => {
        if (!username) return;

        socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
        socketRef.current.emit('register', username);

        socketRef.current.on('users_updated', () => {
            fetchUsersCallback();
        });

        socketRef.current.on('receive_message', (msg) => {
            setIncomingMessage(msg);
        });

        return () => {
            socketRef.current.disconnect();
        };
    }, [username]);

    const sendMessage = (receiverId, text) => {
        if (socketRef.current) {
            socketRef.current.emit('send_message', { receiverId, text });
        }
    };

    return { sendMessage, incomingMessage, socketRef };
};