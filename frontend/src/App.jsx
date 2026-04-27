import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axiosInstance from './api/axiosInstance';
import Auth from './components/Auth';
import ChatWindow from './components/ChatWindow';
import EditProfileModal from './components/EditProfileModal';
import './App.css';

const socket = io('http://localhost:5000', { autoConnect: false });

function App() {
    const [user, setUser] = useState(null);
    const [chats, setChats] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [theme, setTheme] = useState('light');
    const [showEditProfile, setShowEditProfile] = useState(false);

    const loadData = async (userId) => {
        try {
            const [chatsRes, groupsRes] = await Promise.all([
                axiosInstance.get(`/users/chats?userId=${userId}`),
                axiosInstance.get(`/users/groups?userId=${userId}`)
            ]);
            setChats(chatsRes.data);
            setGroups(groupsRes.data);
        } catch (error) {
            console.error("Data loading error", error);
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            const savedTheme = localStorage.getItem('theme') || 'light';
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);

            if (token) {
                try {
                    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const res = await axiosInstance.get('/auth/me');
                    setUser(res.data.user);
                    const userTheme = res.data.user.theme || savedTheme;
                    setTheme(userTheme);
                    document.documentElement.setAttribute('data-theme', userTheme);
                    loadData(res.data.user.id);
                } catch (e) {
                    localStorage.removeItem('token');
                }
            }
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    useEffect(() => {
        if (!user) return;
        socket.connect();
        socket.userId = user.id;
        socket.emit('register', user.username);

        socket.on('group_created', () => loadData(user.id));
        socket.on('users_updated', () => loadData(user.id));
        socket.on('chat_added', (targetUser) => {
            setChats(prev => prev.find(c => c.id === targetUser.id) ? prev : [...prev, targetUser]);
            setActiveChat(targetUser);
        });

        return () => {
            socket.off('group_created');
            socket.off('users_updated');
            socket.off('chat_added');
            socket.disconnect();
        };
    }, [user]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (socket.connected) {
            socket.emit('update_theme', { theme: newTheme });
        }
    };

    const handleLogout = () => {
        if (window.confirm("Вийти з акаунта?")) {
            localStorage.removeItem('token');
            setUser(null);
            setActiveChat(null);
            socket.disconnect();
        }
    };

    const handleCreateGroup = () => {
        const groupName = prompt("Назва групи:");
        const memberName = prompt("Username першого учасника:");
        if (groupName && memberName) {
            socket.emit('create_group', { name: groupName, creatorId: user.id, initialMemberName: memberName });
        }
    };

    const handleLeaveChat = (chat) => {
        if (window.confirm(`Видалити ${chat.isGroup ? 'групу' : 'чат'}?`)) {
            socket.emit('delete_chat', {
                groupId: chat.isGroup ? chat.id : null,
                receiverId: chat.isGroup ? null : chat.id
            });
            if (chat.isGroup) setGroups(prev => prev.filter(g => g.id !== chat.id));
            else setChats(prev => prev.filter(c => c.id !== chat.id));
            setActiveChat(null);
        }
    };

    if (isLoading) return <div className="loading">Завантаження...</div>;
    if (!user) return <Auth onLoginSuccess={(u) => { setUser(u); loadData(u.id); }} />;

    return (
        <div className="app-container">
            <div className="sidebar">
                <div className="sidebar-header">
                    <div className="user-brand">
                        <img
                            src={user.avatar_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                            className="avatar-mini"
                            alt=""
                            onClick={() => setShowEditProfile(true)}
                        />
                        <h3>{user.username}</h3>
                    </div>
                    <div className="header-buttons">
                        <button onClick={toggleTheme} title="Змінити тему">
                            {theme === 'light' ? '🌙' : '☀️'}
                        </button>
                        <button onClick={() => setShowEditProfile(true)} title="Налаштування">⚙️</button>
                        <button onClick={handleLogout} title="Вихід" className="logout-btn">🚪</button>
                    </div>
                </div>

                <div className="chat-list">
                    <div className="list-section">
                        <h4>💬 ПРИВАТНІ ЧАТИ</h4>
                        {chats.map(c => (
                            <div key={c.id} onClick={() => setActiveChat({...c, isGroup: false})}
                                 className={`chat-item ${activeChat?.id === c.id && !activeChat.isGroup ? 'active' : ''}`}>
                                {c.username}
                            </div>
                        ))}
                    </div>
                    <div className="list-section">
                        <h4>👥 ГРУПИ</h4>
                        {groups.map(g => (
                            <div key={g.id} onClick={() => setActiveChat({...g, isGroup: true})}
                                 className={`chat-item ${activeChat?.id === g.id && activeChat.isGroup ? 'active' : ''}`}>
                                # {g.name}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-actions">
                    <button className="action-btn add-user" onClick={() => {
                        const n = prompt("Username:");
                        if (n) socket.emit('add_chat', n);
                    }}>+ Користувач</button>
                    <button className="action-btn add-group" onClick={handleCreateGroup}>+ Група</button>
                </div>
            </div>

            <div className="chat-main">
                {activeChat ? (
                    <ChatWindow
                        activeChat={activeChat}
                        currentUser={user}
                        socket={socket}
                        onAddMember={(gid) => {
                            const name = prompt("Кого додати?");
                            if(name) socket.emit('add_to_group', { groupId: gid, username: name });
                        }}
                        onLeaveChat={handleLeaveChat}
                    />
                ) : (
                    <div className="empty-state">
                        <p>Оберіть чат або створіть групу</p>
                    </div>
                )}
            </div>

            {showEditProfile && (
                <EditProfileModal
                    user={user}
                    onClose={() => setShowEditProfile(false)}
                    onUpdate={(updatedData) => setUser({...user, ...updatedData})}
                />
            )}
        </div>
    );
}

export default App;