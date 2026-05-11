import { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';

function historyUrl(activeChat, currentUserId) {
    return activeChat.isGroup
        ? `/messages/history?groupId=${activeChat.id}`
        : `/messages/history?user1=${currentUserId}&user2=${activeChat.id}`;
}

function isMessageInThread(msg, activeChat, currentUserId) {
    if (activeChat.isGroup) {
        return msg.group_id === activeChat.id;
    }
    return (
        (msg.sender_id === activeChat.id && msg.receiver_id === currentUserId) ||
        (msg.sender_id === currentUserId && msg.receiver_id === activeChat.id)
    );
}

export function useChatMessages(activeChat, currentUser, socket) {
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        if (!activeChat) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get(historyUrl(activeChat, currentUser.id));
                if (!cancelled) setMessages(res.data);
            } catch {
                if (!cancelled) setMessages([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeChat.id, activeChat.isGroup, currentUser.id]);

    useEffect(() => {
        if (!activeChat) return undefined;
        const handleMsg = (msg) => {
            if (!isMessageInThread(msg, activeChat, currentUser.id)) return;
            setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
        };
        socket.on('receive_message', handleMsg);
        return () => socket.off('receive_message', handleMsg);
    }, [activeChat.id, activeChat.isGroup, currentUser.id, socket]);

    return messages;
}
