import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axiosInstance from './api/axiosInstance';
import Auth from './components/Auth';
import ChatWindow from './components/ChatWindow';
import './App.css';

// Ініціалізуємо сокет з відключеним автопідключенням (підключимо після авторизації)
// В App.jsx (вище за функцію App)
const socket = io('http://localhost:5000', { // <--- Прибери тут import.meta.env
    autoConnect: false
});

function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [theme, setTheme] = useState('light');
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);

    // Завантаження списку чатів
    const loadChats = async (userId) => {
        try {
            const res = await axiosInstance.get(`/users/chats?userId=${userId}`);
            setChats(res.data);
        } catch (error) {
            console.error("Помилка завантаження чатів", error);
        }
    };

    // 1. Перевірка сесії при першому завантаженні
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Встановлюємо токен для всіх наступних запитів
                    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    const res = await axiosInstance.get('/auth/me'); // Цей ендпоінт ми додали в AuthController

                    const userData = res.data.user;
                    setUser(userData);

                    // Відновлюємо тему
                    setTheme(userData.theme || 'light');
                    document.documentElement.setAttribute('data-theme', userData.theme || 'light');

                    // Завантажуємо чати
                    loadChats(userData.id);
                } catch (e) {
                    console.error("Токен недійсний або протермінований");
                    localStorage.removeItem('token');
                    delete axiosInstance.defaults.headers.common['Authorization'];
                }
            }
            setIsLoading(false);
        };

        checkAuth();
    }, []);

    // 2. Підключення сокетів ТІЛЬКИ після успішної авторизації
    useEffect(() => {
        if (!user) return;

        socket.connect();
        // Реєструємо сокет-з'єднання для цього користувача
        socket.emit('register', user.username);

        // Обробка помилок сокета
        socket.on('error_msg', (msg) => {
            alert("Помилка: " + msg);
        });

        // Коли ми успішно додали когось у чат
// В App.jsx всередині useEffect для сокетів
        socket.on('chat_added', (targetUser) => {
            setChats(prev => {
                // Перевіряємо, чи немає вже такого чату в списку
                if (!prev.find(c => c.id === targetUser.id)) {
                    return [...prev, targetUser];
                }
                return prev;
            });
            setActiveChat(targetUser); // Одразу відкриваємо вікно чату
        });

        // Коли приходить повідомлення від нового співрозмовника
        socket.on('users_updated', () => {
            loadChats(user.id);
        });

        return () => {
            socket.off('error_msg');
            socket.off('chat_added');
            socket.off('users_updated');
            socket.disconnect();
        };
    }, [user]);

    // Обробка успішного входу/реєстрації з компонента Auth
    const handleLoginSuccess = (userData) => {
        setUser(userData);
        setTheme(userData.theme || 'light');
        document.documentElement.setAttribute('data-theme', userData.theme || 'light');
        loadChats(userData.id);

        const token = localStorage.getItem('token');
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        delete axiosInstance.defaults.headers.common['Authorization'];
        socket.disconnect();
        setUser(null);
        window.location.reload(); // Перезавантажуємо сторінку для очищення стейту
    };

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        socket.emit('update_theme', { theme: newTheme }); // Зберігаємо в БД
    };

    const handleAddChat = () => {
        const name = prompt("Введіть username користувача, якому хочете написати:");
        if (name && name.trim() !== '') {
            socket.emit('add_chat', name.trim());
        }
    };

    // Екран завантаження, поки перевіряється токен
    if (isLoading) {
        return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>;
    }

    // Якщо користувач не авторизований — показуємо компонент авторизації
    if (!user) {
        return <Auth onLoginSuccess={handleLoginSuccess} />;
    }

    // Головний інтерфейс месенджера
    return (
        <div className="app-container">
            {/* Ліва панель */}
            <div className="sidebar">
                <div className="sidebar-header">
                    <h3>Вітаємо, {user.username}</h3>
                    <button onClick={toggleTheme}>Змінити тему ({theme})</button>
                    <button onClick={handleLogout} style={{ marginTop: '5px', background: '#dc3545', color: 'white', border: 'none' }}>
                        Вихід
                    </button>
                </div>

                <div className="chat-list">
                    {chats.length === 0 ? (
                        <p style={{ padding: '20px', textAlign: 'center', color: 'gray' }}>У вас ще немає чатів</p>
                    ) : (
                        chats.map(c => (
                            <div
                                key={c.id}
                                onClick={() => setActiveChat(c)}
                                className={`chat-item ${activeChat?.id === c.id ? 'active' : ''}`}
                            >
                                {c.username}
                            </div>
                        ))
                    )}
                </div>

                <div className="add-chat-btn" onClick={handleAddChat}>
                    + Додати чат
                </div>
            </div>

            {/* Центральна панель чату */}
            <div className="chat-main">
                {activeChat ? (
                    <ChatWindow
                        activeChat={activeChat}
                        currentUser={user}
                        socket={socket}
                    />
                ) : (
                    <div className="empty-state">Оберіть чат ліворуч або додайте новий, щоб почати спілкування</div>
                )}
            </div>
        </div>
    );
}

export default App;