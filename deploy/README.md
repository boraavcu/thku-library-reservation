# THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi — Canlı Dağıtım (Deploy) Kılavuzu

Bu dizin, sistemin **Windows Server + Apache HTTP Server (`*:443`) + PM2 + PostgreSQL** mimarisi üzerinde **`/randevu`** alt dizini altında güvenli şekilde yayınlanması ve **sıfır veri kaybıyla** güncellenmesi için hazırlanan yapılandırma ve otomasyon betiklerini içerir.

---

## 1. Dağıtım Mimarisi Özeti

Canlı ortamda aynı kurumsal alan adı (`https://<KURUMSAL_ALAN_ADI>`) üzerinde çalışan diğer uygulamalara müdahale etmemek adına sistem izole bir alt dizin ve yerel geri döngü (`127.0.0.1`) mimarisiyle çalışır:

- **İstemci (Frontend SPA):** `frontend\dist` klasöründeki statik derleme çıktıları doğrudan Apache `Alias /randevu` yönergesiyle sunulur. Üretimde `vite dev` veya `vite preview` kesinlikle çalıştırılmaz.
- **API & Kimlik Doğrulama (Backend):** Next.js API sunucusu PM2 (`thku-randevu-api`) yönetiminde **yalnızca `127.0.0.1:<BACKEND_PORT>`** (dış ağa kapalı yerel arayüz) üzerinde dinler.
- **Ters Vekil (Reverse Proxy):** Apache `*:443` `VirtualHost` bloğu yalnızca `/randevu/api/` önekiyle gelen istekleri `http://127.0.0.1:<BACKEND_PORT>/api/` adresine aktarır (`Next.js basePath` kullanılmaz, önek çiftlenmez).
- **Veritabanı ve Durum Yönetimi:** Tüm oturum kilidi, Kiosk OTP (`kiosk_otp_tokens`), cihaz parmak izi kilitleri (`kiosk_device_locks`), istek hız sınırlandırması (rate-limit) ve rezervasyon verileri tekil **PostgreSQL** veritabanı üzerinde tutulur (harici bellek-içi önbellek sunucusu veya ek servis gerektirmez).

---

## 2. `deploy/` Dizinindeki Dosyaların Görevleri

| Dosya | Görevi |
| :--- | :--- |
| [`apache-randevu.conf`](./apache-randevu.conf) | Mevcut `*:443` SSL `VirtualHost` bloğunun içine eklenecek Apache `ProxyPass`, `Alias` ve SPA `FallbackResource` yapılandırması. |
| [`derle.cmd`](./derle.cmd) | `backend` (`npm ci`, `npx prisma generate`, `npm run build`) ve `frontend` (`npm ci`, `npm run build` -> `frontend\dist`) üretim derlemelerini sırasıyla hazırlar. Veritabanına yazmaz. |
| [`migration-uygula.cmd`](./migration-uygula.cmd) | `npx prisma migrate deploy` komutuyla yalnızca bekleyen şema değişikliklerini uygular. **Seed çalıştırmaz, veritabanını sıfırlamaz ve mevcut kayıtları silmez.** |
| [`baslat.cmd`](./baslat.cmd) | `BACKEND_PORT` ortam değişkenini doğrulayarak kök dizindeki [`../ecosystem.config.cjs`](../ecosystem.config.cjs) üzerinden `thku-randevu-api` servisini PM2 ile `127.0.0.1:<BACKEND_PORT>` adresinde başlatır ve `pm2 save` ile kaydeder. |

---

## 3. İlk Canlı Kurulum Adımları (Windows Server)

### Adım 1: Ön Gereksinimler
1. **Node.js LTS** (v20 veya üzeri), **PM2** (`npm install -g pm2`) ve **PostgreSQL** kurulu olmalıdır.
2. **Apache HTTP Server** üzerinde şu modüllerin etkin (`LoadModule`) olduğundan emin olun:
   - `mod_proxy` ve `mod_proxy_http` (`/randevu/api/` ters vekil yönlendirmesi için)
   - `mod_alias` (`Alias` ve `RedirectMatch` için)
   - `mod_dir` (`DirectoryIndex` ve SPA sayfa yenilemelerini koruyan `FallbackResource` için)
   - `mod_headers` / `mod_ssl` (mevcut `*:443` yapılandırması kapsamında)

### Adım 2: Ortam Değişkenlerinin Hazırlanması
Proje dizininde (`<PROJE_DIZINI>\backend\.env` ve gerekiyorsa `<PROJE_DIZINI>\frontend\.env.production`) kurumsal ortam değişkenlerini gerçek değerlerle yapılandırın (örnek yer tutucular):
- `DATABASE_URL="postgresql://<DB_KULLANICI>:<DB_SIFRE>@127.0.0.1:<DB_PORT>/<DB_ADI>?schema=public"`
- `NEXTAUTH_URL="https://<KURUMSAL_ALAN_ADI>/randevu/api/auth"`
- `NEXTAUTH_SECRET="<GUCLU_RASTGELE_ANAHTAR>"`
- Microsoft Entra ID (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`), SMTP ve Kampüs Wi-Fi/GPS doğrulama değişkenleri.
- Canlı ortamda demo giriş butonlarını kapatmak için derleme öncesinde istemci tarafında `VITE_ENABLE_DEMO_LOGIN=false` değerini tanımlayın.

### Adım 3: Uygulamanın Derlenmesi ve Veritabanı Şemasının Uygulanması
Yönetici (Administrator) komut isteminde (`cmd.exe`) sırasıyla çalıştırın:

```bat
cd /d "<PROJE_DIZINI>"
call deploy\derle.cmd
call deploy\migration-uygula.cmd
```

### Adım 4: Backend Servisinin PM2 ile Başlatılması
Sunucuda başka hiçbir servis tarafından kullanılmayan boş bir yerel port (`<BACKEND_PORT>`) belirleyin ve PM2 servisini başlatın:

```bat
set BACKEND_PORT=<BACKEND_PORT>
call deploy\baslat.cmd
```
- Doğrulama için `pm2 status` ve `pm2 logs thku-randevu-api` komutlarını kullanabilirsiniz. Servis yalnızca `127.0.0.1:<BACKEND_PORT>` adresini dinleyecektir.

### Adım 5: Apache `*:443` VirtualHost Yapılandırması
[`deploy/apache-randevu.conf`](./apache-randevu.conf) dosyasındaki yönergeleri, sunucudaki mevcut `*:443` `VirtualHost` bloğunun **içine** ekleyin (mevcut SSL sertifika satırlarını değiştirmeyin) ve iki yer tutucuyu gerçek değerlerle güncelleyin:
- `__FRONTEND_DIST_DIR__` -> `<PROJE_DIZINI>/frontend/dist`
- `__BACKEND_PORT__` -> `<BACKEND_PORT>` (Adım 4'te belirlenen port numarası)

> **Kritik Eğik Çizgi (`/`) Kuralı:**
> ```apache
> ProxyPreserveHost On
> ProxyPass        /randevu/api/ http://127.0.0.1:<BACKEND_PORT>/api/
> ProxyPassReverse /randevu/api/ http://127.0.0.1:<BACKEND_PORT>/api/
> ```
> Hem kaynak (`/randevu/api/`) hem de hedef (`/api/`) sonunda eğik çizgi (`/`) bulunmalıdır. Bu sayede `/randevu/api/auth/session` isteği tam olarak `http://127.0.0.1:<BACKEND_PORT>/api/auth/session` adresine iletilir.

Yapılandırma sözdizimini doğrulayıp Apache servisini yeniden yükleyin:
```bat
httpd -t
httpd -k restart
```
Artık uygulama **`https://<KURUMSAL_ALAN_ADI>/randevu/`** adresinden yayındadır.

---

## 4. Sıfır Veri Kayıplı Güncelleme Prosedürü

Canlı sistemde kullanıcılar, rezervasyonlar, kurallar ve denetim logları korunarak yeni bir sürüm yayınlanacağında **kesinlikle `prisma migrate reset` veya `seed` çalıştırılmaz**. Güncelleme şu 4 adımla tamamlanır:

```bat
cd /d "<PROJE_DIZINI>"

:: 1) Güncel kaynak kodunu çekin
git pull origin main

:: 2) Backend ve Frontend dist paketlerini yeniden derleyin (veritabanına dokunmaz)
call deploy\derle.cmd

:: 3) Yalnızca yeni eklenen Prisma migration dosyaları varsa veritabanına uygulayın
call deploy\migration-uygula.cmd

:: 4) PM2 üzerindeki Backend sürecini yeniden başlatın
set BACKEND_PORT=<BACKEND_PORT>
pm2 restart thku-randevu-api --update-env
```

- `frontend\dist` dizini güncellendiği anda Apache yeni statik dosyaları anında sunar (`apache-randevu.conf` değişmediği sürece Apache servisini yeniden başlatmaya gerek yoktur).

---

## 5. Operasyonel Kontroller ve Sorun Giderme

- **PM2 Durum ve Log İzleme:**
  ```bat
  pm2 status
  pm2 logs thku-randevu-api --lines 100
  ```
- **Sayfa Yenilemede (F5) 404 Hatası Alınıyorsa:** Apache üzerinde `mod_dir` modülünün aktif olduğunu ve `<Directory "<PROJE_DIZINI>/frontend/dist">` bloğu içinde `FallbackResource /randevu/index.html` satırının yer aldığını doğrulayın.
- **API İstekleri 502 Bad Gateway Döndürüyorsa:** `pm2 status` ile `thku-randevu-api` sürecinin `online` olduğunu ve `apache-randevu.conf` içindeki `<BACKEND_PORT>` değeriyle PM2'nin dinlediği `BACKEND_PORT` değerinin birebir aynı olduğunu kontrol edin.
- **Demo Verilerinin Temizlenmesi:** İlk testlerin ardından canlı kullanıma geçerken veritabanını sıfırlamak yerine Yönetim Panelindeki (`/randevu/admin`) **"Demo verilerini temizle"** butonunu (`PURGE_TEST_DATA`) kullanarak yalnızca `@demo.local` ve örnek test verilerini güvenle kaldırabilirsiniz.
