import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axiosInstance from './api/axiosInstance';
import Auth from './components/Auth';
import ChatWindow from './components/ChatWindow';
import EditProfileModal from './components/EditProfileModal';
import './App.css';

const socket = io('http://localhost:5000', {
    autoConnect: false
});

function App() {
    const [groups, setGroups] = useState([]);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [theme, setTheme] = useState('light');
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [showEditProfile, setShowEditProfile] = useState(false);

    const loadChats = async (userId) => {
        try {
            const res = await axiosInstance.get(`/users/chats?userId=${userId}`);
            setChats(res.data);
            // Тут також можна було б завантажити групи через API, якщо вони є в БД
        } catch (error) {
            console.error("Помилка завантаження чатів", error);
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const res = await axiosInstance.get('/auth/me');
                    const userData = res.data.user;
                    setUser(userData);
                    setTheme(userData.theme || 'light');
                    document.documentElement.setAttribute('data-theme', userData.theme || 'light');
                    loadChats(userData.id);
                } catch (e) {
                    localStorage.removeItem('token');
                    delete axiosInstance.defaults.headers.common['Authorization'];
                }
            }
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    useEffect(() => {
        if (!user) return;

        socket.connect();
        socket.emit('register', user.username);

        socket.on('error_msg', (msg) => alert("Помилка: " + msg));

        socket.on('group_created', (newGroup) => {
            setGroups(prev => [...prev, newGroup]);
            setActiveChat({ ...newGroup, isGroup: true });
        });

        socket.on('chat_added', (targetUser) => {
            setChats(prev => {
                if (!prev.find(c => c.id === targetUser.id)) {
                    return [...prev, targetUser];
                }
                return prev;
            });
            setActiveChat(targetUser);
        });

        socket.on('users_updated', () => loadChats(user.id));

        return () => {
            socket.off('error_msg');
            socket.off('group_created');
            socket.off('chat_added');
            socket.off('users_updated');
            socket.disconnect();
        };
    }, [user]);

    const handleLoginSuccess = (userData) => {
        setUser(userData);
        setTheme(userData.theme || 'light');
        document.documentElement.setAttribute('data-theme', userData.theme || 'light');
        loadChats(userData.id);
        const token = localStorage.getItem('token');
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    };

    const handleCreateGroup = () => {
        const groupName = prompt("Введіть назву групи:");
        if (!groupName) return;

        const memberName = prompt("Введіть username першого учасника (обов'язково):");
        if (!memberName) {
            alert("Група повинна мати хоча б одного учасника!");
            return;
        }

        // Відправляємо на бекенд назву групи та ім'я першого учасника
        socket.emit('create_group', {
            name: groupName.trim(),
            creatorId: user.id,
            initialMemberName: memberName.trim()
        });
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        window.location.reload();
    };

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        socket.emit('update_theme', { theme: newTheme });
    };

    const handleAddChat = () => {
        const name = prompt("Введіть username користувача:");
        if (name && name.trim() !== '') {
            socket.emit('add_chat', name.trim());
        }
    };

    if (isLoading) return <div className="loading">Завантаження...</div>;
    if (!user) return <Auth onLoginSuccess={handleLoginSuccess} />;

    return (
        <div className="app-container">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h3>{user.username}</h3>
                    <div className="header-buttons">
                        <button onClick={() => setShowEditProfile(true)}>⚙️ Профіль</button>
                        <button onClick={toggleTheme}>{theme === 'light' ? '🌙' : '☀️'}</button>
                        <button onClick={handleLogout} className="logout-btn">🚪</button>
                    </div>
                </div>

                <div className="chat-list">
                    <div className="list-section">
                        <h4>💬 Приватні чати</h4>
                        {chats.map(c => (
                            <div key={c.id}
                                 onClick={() => setActiveChat({...c, isGroup: false})}
                                 className={`chat-item ${activeChat?.id === c.id && !activeChat.isGroup ? 'active' : ''}`}>
                                {c.username}
                            </div>
                        ))}
                    </div>

                    <div className="list-section">
                        <h4>👥 Групи</h4>
                        {groups.map(g => (
                            <div key={g.id}
                                 onClick={() => setActiveChat({...g, isGroup: true})}
                                 className={`chat-item group-item ${activeChat?.id === g.id && activeChat.isGroup ? 'active' : ''}`}>
                                # {g.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-actions">
                    <button className="action-btn add-user" onClick={handleAddChat}>+ Користувач</button>
                    <button className="action-btn add-group" onClick={handleCreateGroup}>+ Група</button>
                </div>
            </div>

            <div className="chat-main">
                {activeChat ? (
                    <ChatWindow activeChat={activeChat} currentUser={user} socket={socket} />
                ) : (
                    <div className="empty-state">Оберіть чат або створіть групу</div>
                )}
            </div>

            {showEditProfile && (
                <EditProfileModal
                    user={user}
                    onClose={() => setShowEditProfile(false)}
                    onUpdate={(updatedData) => setUser(prev => ({...prev, ...updatedData}))}
                />
            )}
        </div>
    );
}

export default App;