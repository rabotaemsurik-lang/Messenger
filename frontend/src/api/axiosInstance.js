import axios from 'axios';

const axiosInstance = axios.create({
    // Пріоритет на змінну оточення з докера, або дефолт
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

export default axiosInstance;