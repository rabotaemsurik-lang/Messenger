import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '../api/axiosInstance';

const ChatWindow = ({ activeChat, currentUser, socket, onAddMember, onLeaveChat }) => {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const messagesEndRef = useRef(null);

    const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

    useEffect(() => {
        if (!activeChat) return;
        const fetchHistory = async () => {
            try {
                const url = activeChat.isGroup
                    ? `/messages/history?groupId=${activeChat.id}`
                    : `/messages/history?user1=${currentUser.id}&user2=${activeChat.id}`;
                const res = await axiosInstance.get(url);
                setMessages(res.data);
            } catch { setMessages([]); }
        };
        fetchHistory();
    }, [activeChat.id]);

    useEffect(() => {
        const handleMsg = (msg) => {
            const isRel = activeChat.isGroup ? msg.group_id === activeChat.id :
                (msg.sender_id === activeChat.id && msg.receiver_id === currentUser.id) ||
                (msg.sender_id === currentUser.id && msg.receiver_id === activeChat.id);
            if (isRel) setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        };
        socket.on('receive_message', handleMsg);
        return () => socket.off('receive_message', handleMsg);
    }, [activeChat.id, socket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        socket.emit(activeChat.isGroup ? 'send_group_message' : 'send_message', {
            [activeChat.isGroup ? 'groupId' : 'receiverId']: activeChat.id,
            text: text.trim()
        });
        setText('');
    };

    return (
        <div className="chat-main-layout">
            <div className="chat-header">
                <div className="user-info" onClick={() => !activeChat.isGroup && setShowProfile(true)}
                     style={{ cursor: activeChat.isGroup ? 'default' : 'pointer' }}>
                    <img
                        src={activeChat.avatar_url || defaultAvatar}
                        alt=""
                        className="avatar-small"
                        onError={(e) => e.target.src = defaultAvatar}
                    />
                    <div>
                        <h2>{activeChat.isGroup ? activeChat.name : activeChat.username}</h2>
                        <span className="status-text">
                            {activeChat.isGroup ? 'Груповий чат' : 'Натисніть для профілю'}
                        </span>
                    </div>
                </div>
                <div className="header-actions">
                    {activeChat.isGroup && <button className="add-member-btn" onClick={() => onAddMember(activeChat.id)}>➕</button>}
                    <button className="leave-btn" onClick={() => onLeaveChat(activeChat)}>🚪</button>
                </div>
            </div>

            {showProfile && !activeChat.isGroup && (
                <div className="modal-overlay" onClick={() => setShowProfile(false)}>
                    <div className="profile-card" onClick={e => e.stopPropagation()}>
                        <div className="profile-avatar-container">
                            <img
                                src={activeChat.avatar_url || defaultAvatar}
                                alt=""
                                className="profile-avatar-large"
                                onError={(e) => e.target.src = defaultAvatar}
                            />
                        </div>
                        <h3 className="profile-name">{activeChat.username}</h3>
                        <div className="profile-details">
                            <p><strong>Про себе:</strong> {activeChat.bio || "Не вказано"}</p>
                            <p><strong>День народження:</strong> {activeChat.birthday ? new Date(activeChat.birthday).toLocaleDateString() : "Не вказано"}</p>
                        </div>
                        <button className="modal-close-btn" onClick={() => setShowProfile(false)}>Закрити</button>
                    </div>
                </div>
            )}

            <div className="chat-messages">
                {messages.map((msg) => {
                    const isMine = msg.sender_id === currentUser.id;
                    return (
                        <div key={msg.id || Math.random()} className={`message-row ${isMine ? 'mine' : 'theirs'}`}>
                            <div className="bubble-container">
                                {!isMine && activeChat.isGroup && <span className="sender-name">{msg.sender_name}</span>}
                                <div className="message-bubble">
                                    {msg.content}
                                    <span className="msg-time">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-area" onSubmit={handleSend}>
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишіть повідомлення..." />
                <button type="submit" disabled={!text.trim()}>➤</button>
            </form>
        </div>
    );
};

export default ChatWindow;