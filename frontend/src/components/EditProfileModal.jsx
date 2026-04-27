import React, { useState } from 'react';
import axiosInstance from '../api/axiosInstance';

const EditProfileModal = ({ user, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({
        bio: user.bio || '',
        birthday: user.birthday ? user.birthday.split('T')[0] : '',
        avatar_url: user.avatar_url || ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axiosInstance.put('/users/profile', {
                userId: user.id,
                ...formData
            });
            onUpdate(res.data); // Оновлюємо дані юзера в основному стейті App.jsx
            alert("Профіль оновлено!");
            onClose();
        } catch (err) {
            console.error(err);
            alert("Помилка оновлення");
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="profile-card edit-modal" onClick={e => e.stopPropagation()}>
                <h2>Налаштування профілю</h2>
                <form onSubmit={handleSubmit}>
                    <label>URL Аватарки:</label>
                    <input
                        type="text"
                        value={formData.avatar_url}
                        onChange={e => setFormData({...formData, avatar_url: e.target.value})}
                        placeholder="https://image.com/photo.jpg"
                    />

                    <label>Про себе:</label>
                    <textarea
                        value={formData.bio}
                        onChange={e => setFormData({...formData, bio: e.target.value})}
                        placeholder="Розкажіть про себе..."
                    />

                    <label>Дата народження:</label>
                    <input
                        type="date"
                        value={formData.birthday}
                        onChange={e => setFormData({...formData, birthday: e.target.value})}
                    />

                    <div className="modal-buttons">
                        <button type="submit" className="save-btn">Зберегти</button>
                        <button type="button" onClick={onClose} className="cancel-btn">Скасувати</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfileModal;