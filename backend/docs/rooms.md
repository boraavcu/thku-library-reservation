# Context: Rooms API Route (backend/src/app/api/rooms/route.js)

## 📌 1. Dosyanın Amacı ve Rolü
Bu dosya, "THK University Kütüphane Rezervasyon Sistemi"nde kütüphanede bulunan **çalışma odalarının (Rooms) verilerini sağlayan** ana API uç noktasıdır. Frontend tarafında `Dashboard.jsx` (Odaları özetlemek için) ve `/reserve` (Rezervasyon filtrelemesi yapmak için) sayfaları tarafından çağrılır.

## 🛠 2. Teknoloji Yığını ve Mimarisi
- **Framework:** Next.js 14+ App Router API Route (`app/api/rooms/route.js`)
- **Veritabanı ORM:** Prisma Client (`@/lib/db`)
- **Güvenlik/Auth:** Özel Fonksiyonel Middleware (`@/middleware/checkRulesAcceptance`)
- **Response Formatı:** `NextResponse.json()`

## 🧠 3. İş Mantığı ve Güvenlik Akışı (Business Logic)

### A. Güvenlik ve Kurallar Bariyeri (Middleware Guard)
- Dosyadaki `GET` metodunun ilk satırında güvenlik duvarı (`checkRulesAcceptance`) çalışır.
- Oturumu olmayan (401) veya kütüphane kurallarını onaylamamış (403) hiçbir kullanıcı, kütüphane odalarının listesini göremez. API bu isteği anında reddeder.

### B. GET Metodu (Oda Listeleme) - 🚀 Kritik Filtreleme
- Odalar veritabanından çekilirken Prisma'da **`where: { isActive: true }`** filtresi UYGULANMAK ZORUNDADIR. 
- **Neden?** Kütüphane yönetimi (Admin) bir odayı tadilata aldığında veya geçici olarak kapattığında (`isActive: false`), öğrencilerin bu odaları arayüzde görüp rezerve etmeye çalışması kesinlikle engellenmelidir.
- Odalar kullanıcı deneyimi (UX) açısından her zaman oda numarasına göre sıralı dönmelidir (`orderBy: { roomNumber: 'asc' }`).

### C. Hata Yönetimi (Error Handling)
- Tüm Prisma sorguları `try/catch` bloğu içinde olmalıdır.
- Olası bir veritabanı bağlantı hatasında sistem çökmemeli, frontend'e `{ error: "Database error" }` objesi ve HTTP `500 Internal Server Error` statü kodu dönmelidir. Konsola (`console.error`) hatanın teknik detayı yazdırılmalıdır.

## ⚠️ 4. Cursor / AI İçin Geliştirme Kuralları (Strict Constraints)
1. **Guard İhlali Yapma:** `GET` veya gelecekte eklenecek herhangi bir metodun (`POST`, `PUT`) başındaki `rulesCheck` middleware kontrolünü asla silme veya bypass etme.
2. **Aktiflik Kuralı (isActive):** Öğrenciler (STUDENT rolü) için veri dönüyorsan DAİMA `where: { isActive: true }` filtresini kullan. (Sadece gelecekte bir Admin paneli için `?all=true` gibi bir query parametresi gelirse pasif odalar dönülebilir).
3. **Yeni Metodlar (POST/PUT/DELETE):** Eğer bu rotaya ileride "Yeni Oda Ekleme" (`POST`) veya "Oda Güncelleme" (`PUT`) metodları eklenecekse, `checkRulesAcceptance` kontrolüne ek olarak **Kullanıcı Yetki Kontrolü (Role Authorization)** yapılmalıdır. Öğrenciler oda ekleyemez/silemez, sadece `ADMIN` veya `LIBRARIAN` yetkisi olanlar bu metodları çalıştırabilmelidir.