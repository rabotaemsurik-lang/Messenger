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
    useEffect(() => {
        socket.on('receive_message', (newMessage) => {
            setMessages((prev) => {
                // Перевіряємо, чи повідомлення вже існує за ID
                const exists = prev.find(m => m.id === newMessage.id);
                if (exists) return prev;
                return [...prev, newMessage];
            });
        });

        return () => socket.off('receive_message');
    }, [socket]);

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
    const [showProfile, setShowProfile] = useState(false);
    return (
        <>

            <div className="chat-header" style={{ cursor: 'pointer' }} onClick={() => setShowProfile(true)}>
                <img
                    src={activeChat.avatar_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                    alt="avatar"
                    className="avatar-small"
                    onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; }}
                />
                <h2>{activeChat.username}</h2>
                <span className="info-hint">Натисніть, щоб глянути профіль</span>
            </div>

            {/* Модальне вікно профілю */}
            {showProfile && (
                <div className="modal-overlay" onClick={() => setShowProfile(false)}>
                    <div className="profile-card" onClick={e => e.stopPropagation()}>
                        <img
                            src={activeChat.avatar_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                            alt="avatar"
                            className="avatar-small"
                            onError={(e) => { e.target.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png'; }}
                        />
                        <h3>{activeChat.username}</h3>
                        <p><strong>Про себе:</strong> {activeChat.bio || 'Інформація відсутня'}</p>
                        <p><strong>День народження:</strong> {activeChat.birthday ? new Date(activeChat.birthday).toLocaleDateString() : 'Не вказано'}</p>
                        <button onClick={() => setShowProfile(false)}>Закрити</button>
                    </div>
                </div>
            )}

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