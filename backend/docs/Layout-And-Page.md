# Context: layout.js & page.js

##  1. Dosyaların Amacı ve Mimari Rolü

`backend/src/app/layout.js` ve `backend/src/app/page.js`, Next.js App Router mimarisinin zorunlu kök şablon (Root Layout) ve servis durum sayfası dosyalarıdır. Projede kullanıcı arayüzü `frontend/` (React + Vite) tarafında sunulduğu ve `backend/` (Next.js) tamamen `/api/*` uç noktalarını çalıştıran bir API sunucusu (Headless Backend) olarak görev yaptığı için bu iki dosya Next.js çalışma zamanı (runtime) bütünlüğünü sağlar.

##  2. İçerik ve Yapı

- **`layout.js`:** `next/font/google` üzerinden `Geist` ve `Geist_Mono` yazı tiplerini yükler, `globals.css` dosyasını bağlar ve `<html>` / `<body>` sarmalayıcısını oluşturur.
- **`page.js`:** Doğrudan backend portuna (`localhost:3000`) tarayıcıdan girildiğinde Next.js'in ayakta olduğunu gösteren varsayılan karşılama bileşenidir.

##  3. Bağlantılı Olduğu Dosyalar

- `backend/src/app/globals.css`