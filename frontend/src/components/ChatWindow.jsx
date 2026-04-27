import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';

const ChatWindow = ({ activeChat, currentUser, socket }) => {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const messagesEndRef = useRef(null);

    // Завантаження історії при зміні активного чату
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axiosInstance.get(`/messages/history?user1=${currentUser.id}&user2=${activeChat.id}`);
                setMessages(res.data);
            } catch (error) {
                console.error("Помилка завантаження історії", error);
            }
        };
        fetchHistory();
    }, [activeChat.id, currentUser.id]);

    // Слухаємо нові повідомлення по сокету
    useEffect(() => {
        const handleReceiveMessage = (msg) => {
            // Перевіряємо, чи це повідомлення стосується відкритого зараз чату
            if (
                (msg.sender_id === activeChat.id && msg.receiver_id === currentUser.id) ||
                (msg.sender_id === currentUser.id && msg.receiver_id === activeChat.id)
            ) {
                setMessages((prev) => [...prev, msg]);
            }
        };

        socket.on('receive_message', handleReceiveMessage);

        return () => {
            socket.off('receive_message', handleReceiveMessage);
        };
    }, [activeChat.id, currentUser.id, socket]);

    // Автоматична прокрутка вниз при новому повідомленні
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim()) return;

        socket.emit('send_message', {
            receiverId: activeChat.id,
            text: text.trim()
        });

        setText('');
    };

    return (
        <>
            <div className="chat-header">
                <h2>{activeChat.username}</h2>
            </div>

            <div className="chat-messages">
                {messages.map((msg, idx) => {
                    const isMine = msg.sender_id === currentUser.id;
                    return (
                        <div key={idx} className={`message ${isMine ? 'my-msg' : 'their-msg'}`}>
                            {msg.content}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSend}>
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Напишіть повідомлення..."
                    autoFocus
                />
                <button type="submit">Надіслати</button>
            </form>
        </>
    );
};

export default ChatWindow;