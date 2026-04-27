import React, { useState } from 'react';
import axiosInstance from '../api/axiosInstance';
// Файл стилів можна залишити, якщо він існує, або закоментувати, якщо його немає
import './Auth.css';

const Auth = ({ onLoginSuccess }) => {
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isLoginMode && password !== confirmPassword) {
            return setError("Паролі не співпадають!");
        }

        try {
            const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

// Тепер повний шлях буде: baseURL + endpoint = .../api/auth/login
            const { data } = await axiosInstance.post(endpoint, { username, password });
            localStorage.setItem('token', data.token);
            onLoginSuccess(data.user);
        } catch (err) {
            setError(err.response?.data?.error || "Помилка сервера");
        }
    };

    return (
        <div className="auth-container">
            <form onSubmit={handleSubmit} className="auth-form">
                <h2>{isLoginMode ? 'Вхід' : 'Реєстрація'}</h2>
                {error && <div className="error-msg">{error}</div>}

                <input
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                />

                <div className="password-input-wrapper" style={{ display: 'flex', gap: '5px' }}>
                    <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Пароль"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{ flex: 1 }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ padding: '0 10px', cursor: 'pointer' }}
                    >
                        {showPassword ? "Сховати" : "Показати"}
                    </button>
                </div>

                {!isLoginMode && (
                    <div className="password-input-wrapper">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Підтвердіть пароль"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                            style={{ width: '100%', marginTop: '10px' }}
                        />
                    </div>
                )}

                <button type="submit" style={{ width: '100%', marginTop: '15px' }}>
                    {isLoginMode ? 'Увійти' : 'Зареєструватись'}
                </button>
                <p onClick={() => setIsLoginMode(!isLoginMode)} className="toggle-mode" style={{ cursor: 'pointer', marginTop: '10px', color: 'blue', textAlign: 'center' }}>
                    {isLoginMode ? 'Немає акаунту? Реєстрація' : 'Вже є акаунт? Увійти'}
                </p>
            </form>
        </div>
    );
};

export default Auth;