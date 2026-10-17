// src/lib/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // ✅ Kurallar kabul edilmemiş
    if (error.response?.data?.requiresRulesAcceptance) {
      console.warn("⚠️ Backend: Kurallar kabul edilmemiş!");
      
      // Event fırlat
      window.dispatchEvent(new CustomEvent('rulesRejected'));
      
      // ✅ BONUS: Toast göster (eğer toast kütüphanesi kullanıyorsanız)
      // toast.warning("Kuralları tekrar kabul etmeniz gerekiyor!");
    }
    
    // ✅ Oturum süresi dolmuş
    else if (error.response?.status === 401) {
      console.log("Oturum süresi dolmuş, çıkış yapılıyor...");
      
      // ✅ BONUS: Toast göster
      // toast.error("Oturumunuz sona erdi, lütfen tekrar giriş yapın.");
      
      // 1 saniye sonra yönlendir (toast görünsün diye)
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    }
    
    // ✅ Diğer hatalar
    else {
      console.error("API Hatası:", error.response?.data?.error || error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;
