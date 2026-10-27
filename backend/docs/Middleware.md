# Context: middleware.js

##  1. Dosyanın Amacı ve Mimari Rolü

`middleware.js`, Next.js Edge katmanında çalışan ve yönetim paneli alt alan adına (`panel.library.thk.edu.tr`) gelen istekleri sayfa henüz yüklenmeden önce JWT token üzerinden denetleyen güvenlik duvarıdır.

##  2. İş Mantığı ve Alan Adı Koruması

1. İstek başlığındaki `host` değeri kontrol edilir.
2. Eğer istek `panel.library.thk.edu.tr` üzerinden geliyorsa `next-auth/jwt` (`getToken`) ile kullanıcının şifreli oturum jetonu okunur:
   - Oturum yoksa (`!token`) kullanıcı `/` (Giriş) sayfasına yönlendirilir.
   - Kullanıcının rolü `["ADMIN", "LIBRARIAN", "SUPER_ADMIN"]` listesinde değilse (yani `STUDENT` ise), kullanıcı anında öğrenci portalına (`process.env.FRONTEND_URL || "https://library.thk.edu.tr"`) yönlendirilir.
3. `config.matcher` ayarı ile `/_next`, `/api` ve `/favicon.ico` statik/servis rotaları bu yönlendirmeden muaf tutulur.

##  3. Bağlantılı Olduğu Dosyalar

- `backend/src/app/api/auth/[...nextauth]/route.js`
- `frontend/src/App.jsx`