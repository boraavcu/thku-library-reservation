require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed başlatılıyor...");

  // 1. v3_admin_login.md Gereği Super Admin Oluşturma
  const superAdmin = await prisma.user.upsert({
    where: { email: "admin@thk.edu.tr" },
    update: { role: "SUPER_ADMIN", isActive: true },
    create: {
      email: "admin@thk.edu.tr",
      fullName: "THKÜ Sistem Yöneticisi",
      department: "Bilgi İşlem Müdürlüğü",
      role: "SUPER_ADMIN",
      acceptedAgreementVersion: "v1.0",
      isActive: true,
    },
  });
  console.log(`✅ Super Admin hazır: ${superAdmin.email}`);

  // 2. Odaları Upsert Et (Mevcut rezervasyonları silmeden günceller/ekler)
  const roomList = [
    { roomNumber: "R101", name: "Atatürk", capacity: 7, isActive: true },
    { roomNumber: "R102", name: "Gökçen", capacity: 7, isActive: true },
    { roomNumber: "R103", name: "Uçantürk", capacity: 7, isActive: true },
    { roomNumber: "R104", name: "İstikbal", capacity: 7, isActive: true },
  ];

  for (const room of roomList) {
    await prisma.room.upsert({
      where: { roomNumber: room.roomNumber },
      update: { name: room.name, capacity: room.capacity, isActive: room.isActive },
      create: room,
    });
  }
  console.log(`✅ ${roomList.length} çalışma odası hazır!`);

  // 3. Aktif Sözleşme (v1.0)
  const agreementContent = `1. Maksimum Rezervasyon Süresi
Çalışma odaları günde en fazla 3 saat süreyle rezerve edilebilir. Süre uzatmaları müsaitlik durumuna bağlıdır ve süre dolmadan 15 dakika önce danışmadan talep edilmelidir. Aynı grubun farklı isimlerle ardışık rezervasyon yapması yasaktır.

2. Geç Kalma / Gelmeme (No-Show)
Başlangıç saatinden itibaren 15 dakika içinde odaya giriş yapılmazsa rezervasyon otomatik olarak iptal edilir ve oda diğer öğrencilerin kullanımına açılır. Tekrarlanan gelmeme durumları (dönem içinde 3 kezden fazla), rezervasyon ayrıcalıklarının 30 güne kadar askıya alınmasına neden olabilir.

3. Sessizlik ve Kullanım Kuralları
Kullanıcılar akademik çalışmaya uygun sessiz bir ortam sağlamalıdır. Yüksek sesli konuşmalar, kulaklıksız müzik veya rahatsız edici davranışlara izin verilmez. Temizliği korumak için (kapalı şişedeki su hariç) yiyecek ve içecek tüketimi kesinlikle yasaktır.

4. Ekipman Sorumluluğu
Kullanıcılar rezervasyon süresince kütüphane mülküne, mobilyalara veya teknik ekipmanlara verilen her türlü hasardan sorumludur. Kütüphane ekipmanlarının fişini çekmeyiniz. Lütfen odaya girdiğinizde mevcut sorunları derhal bildirin.

5. Grup Çalışması
Çalışma odaları grup çalışması (en az 2 kişi) için tasarlanmıştır. Her oda en fazla 7 kişi kapasitesine sahiptir. Bireysel çalışan öğrenciler genel okuma salonlarını kullanmalıdır.

6. Günlük Rezervasyon Limiti
Her öğrenci günde yalnızca 1 (bir) adet rezervasyon yapabilir. Aynı gün içinde ikinci bir rezervasyon talebi sistem tarafından reddedilecektir.`;

  await prisma.agreement.updateMany({ data: { isActive: false } });
  const agreement = await prisma.agreement.upsert({
    where: { version: "v1.0" },
    update: { title: "Kullanım Kuralları", content: agreementContent, isActive: true },
    create: {
      title: "Kullanım Kuralları",
      version: "v1.0",
      isActive: true,
      content: agreementContent,
    },
  });
  console.log(`✅ Sözleşme aktif edildi: "${agreement.title}" (${agreement.version})`);

  // 4. Rezervasyon Kuralları
  const rules = [
    { ruleName: "MIN_PARTICIPANTS", ruleType: "INTEGER", ruleValue: { value: 2 } },
    { ruleName: "MAX_PARTICIPANTS", ruleType: "INTEGER", ruleValue: { value: 7 } },
    { ruleName: "MAX_DURATION_HOURS", ruleType: "INTEGER", ruleValue: { value: 3 } },
    { ruleName: "MAX_ADVANCE_DAYS", ruleType: "INTEGER", ruleValue: { value: 3 } },
    { ruleName: "DAILY_RELEASE_HOUR", ruleType: "INTEGER", ruleValue: { value: 8 } },
  ];

  for (const rule of rules) {
    await prisma.reservationRule.upsert({
      where: { ruleName: rule.ruleName },
      update: { ruleValue: rule.ruleValue, ruleType: rule.ruleType, isActive: true },
      create: { ruleName: rule.ruleName, ruleType: rule.ruleType, ruleValue: rule.ruleValue, isActive: true },
    });
  }
  console.log(`✅ ${rules.length} rezervasyon kuralı eklendi/güncellendi!`);

  // 5. Sunum İçin Örnek Duyuru (Dashboard'da görünmesi için)
  const existingAnnouncements = await prisma.announcement.count();
  if (existingAnnouncements === 0) {
    await prisma.announcement.create({
      data: {
        title: {
          tr: "THKÜ Kütüphane Grup Çalışma Odaları Rezervasyon Sistemi Açıldı",
          en: "THKU Library Group Study Room Reservation System is Now Open",
        },
        content: {
          tr: "Öğrencilerimiz kurumsal Microsoft (@stu.thk.edu.tr) hesapları ile giriş yaparak çalışma odalarını rezerve edebilir ve kütüphane girişindeki Kiosk ekranından QR kod ile check-in yapabilirler.",
          en: "Students can log in with their institutional Microsoft accounts to reserve study rooms and check in via QR code at the library kiosk.",
        },
        priority: "HIGH",
        isPinned: true,
        isActive: true,
        createdBy: superAdmin.id,
        publishedAt: new Date(),
      },
    });
    console.log("✅ Örnek sunum duyurusu eklendi!");
  }
}

main()
  .catch((e) => {
    console.error("❌ Hata:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });