require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function getDateOffset(daysOffset) {
  const now = new Date();
  const trDateStr = now.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const base = new Date(`${trDateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + daysOffset);
  return base;
}

function getTimeUTC(hour, minute = 0, second = 0) {
  return new Date(Date.UTC(1970, 0, 1, hour, minute, second));
}

async function main() {
  console.log("🌱 THKÜ Kütüphane Sistemi Zengin Analitik Demo Verileri Yükleniyor...");

  await prisma.reservationParticipant.deleteMany();
  await prisma.penaltyHistory.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.adminAction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.emailQueue.deleteMany();
  await prisma.notification.deleteMany();

  // 1. Yetkili Hesapları (Kütüphane Müdürü: boraa-35@hotmail.com)
  const superAdmin = await prisma.user.upsert({
    where: { email: "bim.demo@demo.local" },
    update: { role: "SUPER_ADMIN", fullName: "THKÜ Sistem Yöneticisi (BİM)", department: "Bilgi İşlem Müdürlüğü", acceptedAgreementVersion: "v1.0", isActive: true },
    create: { email: "bim.demo@demo.local", fullName: "THKÜ Sistem Yöneticisi (BİM)", department: "Bilgi İşlem Müdürlüğü", role: "SUPER_ADMIN", acceptedAgreementVersion: "v1.0", isActive: true },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "boraa-35@hotmail.com" },
    update: { role: "ADMIN", fullName: "Kütüphane Müdürü (Bora Avcu)", department: "Kütüphane ve Dokümantasyon Daire Bşk.", acceptedAgreementVersion: "v1.0", isActive: true },
    create: { email: "boraa-35@hotmail.com", fullName: "Kütüphane Müdürü (Bora Avcu)", department: "Kütüphane ve Dokümantasyon Daire Bşk.", role: "ADMIN", acceptedAgreementVersion: "v1.0", isActive: true },
  });

  const librarianUser = await prisma.user.upsert({
    where: { email: "gorevli.demo@demo.local" },
    update: { role: "LIBRARIAN", fullName: "Kütüphane Görevlisi", department: "Kütüphane ve Dokümantasyon", acceptedAgreementVersion: "v1.0", isActive: true },
    create: { email: "gorevli.demo@demo.local", fullName: "Kütüphane Görevlisi", department: "Kütüphane ve Dokümantasyon", role: "LIBRARIAN", acceptedAgreementVersion: "v1.0", isActive: true },
  });

  // 2. 18 Öğrenci (Sadece Öğrenci 1 gerçek: s250444902@stu.thk.edu.tr, diğer 17 öğrenci rastgele @demo.local)
  const studentDefinitions = [
    { email: "s250444902@stu.thk.edu.tr", fullName: "Bora Avcu (Öğrenci 1)", studentNumber: "250444902", department: "Bilgisayar Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci2.x91@demo.local", fullName: "Ayşe Yılmaz (Öğrenci 2)", studentNumber: "990000002", department: "Havacılık ve Uzay Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci3.k42@demo.local", fullName: "Mehmet Demir (Öğrenci 3)", studentNumber: "990000003", department: "Yazılım Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci4.m18@demo.local", fullName: "Zeynep Kaya (Öğrenci 4)", studentNumber: "990000004", department: "Elektrik-Elektronik Mühendisliği", penaltyPoints: 15, isBanned: false },
    { email: "demo.ogrenci5.p77@demo.local", fullName: "Caner Aydın (Öğrenci 5 - Sınırda)", studentNumber: "990000005", department: "Makine Mühendisliği", penaltyPoints: 30, isBanned: false },
    { email: "demo.ogrenci6.r33@demo.local", fullName: "Elif Şahin (Öğrenci 6)", studentNumber: "990000006", department: "Endüstri Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci7.t55@demo.local", fullName: "Burak Çelik (Öğrenci 7)", studentNumber: "990000007", department: "Pilotaj", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci8.v12@demo.local", fullName: "Selin Arslan", studentNumber: "990000008", department: "Bilgisayar Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci9.z84@demo.local", fullName: "Emre Koç", studentNumber: "990000009", department: "Havacılık ve Uzay Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci10.b29@demo.local", fullName: "Deniz Özkan", studentNumber: "990000010", department: "Yazılım Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci11.n63@demo.local", fullName: "Merve Çetin", studentNumber: "990000011", department: "Bilgisayar Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci12.c47@demo.local", fullName: "Oğuzhan Yıldız", studentNumber: "990000012", department: "Pilotaj", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci13.f81@demo.local", fullName: "Ceren Aksoy", studentNumber: "990000013", department: "Endüstri Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci14.h24@demo.local", fullName: "Kaan Polat", studentNumber: "990000014", department: "Elektrik-Elektronik Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci15.j59@demo.local", fullName: "Gizem Güler", studentNumber: "990000015", department: "Havacılık ve Uzay Mühendisliği", penaltyPoints: 0, isBanned: false },
    { email: "demo.ogrenci16.l36@demo.local", fullName: "Tolga Doğan", studentNumber: "990000016", department: "Makine Mühendisliği", penaltyPoints: 15, isBanned: false },
    { email: "demo.ogrenci17.q95@demo.local", fullName: "Büşra Korkmaz", studentNumber: "990000017", department: "Yazılım Mühendisliği", penaltyPoints: 0, isBanned: false },
    {
      email: "demo.ogrenci18.w70@demo.local",
      fullName: "Hakan Yavuz (Banlı Öğrenci)",
      studentNumber: "990000018",
      department: "Lojistik Yönetimi",
      penaltyPoints: 45,
      isBanned: true,
      banUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      banReason: "Dönem içinde 3 kez No-Show (Kiosk kodu girmeme) kural ihlali.",
    },
  ];

  const students = [];
  for (const s of studentDefinitions) {
    const created = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        fullName: s.fullName,
        studentNumber: s.studentNumber,
        department: s.department,
        role: "STUDENT",
        penaltyPoints: s.penaltyPoints,
        isBanned: s.isBanned,
        banUntil: s.banUntil || null,
        banReason: s.banReason || null,
        acceptedAgreementVersion: "v1.0",
        isActive: true,
      },
      create: {
        email: s.email,
        fullName: s.fullName,
        studentNumber: s.studentNumber,
        department: s.department,
        role: "STUDENT",
        penaltyPoints: s.penaltyPoints,
        isBanned: s.isBanned,
        banUntil: s.banUntil || null,
        banReason: s.banReason || null,
        acceptedAgreementVersion: "v1.0",
        isActive: true,
      },
    });
    students.push(created);
  }

  // 3. Çalışma Odaları (R103 -> Hürkuş olarak güncellendi)
  const roomList = [
    { roomNumber: "R101", name: "Atatürk", capacity: 8, isActive: true },
    { roomNumber: "R102", name: "Gökçen", capacity: 8, isActive: true },
    { roomNumber: "R103", name: "Hürkuş", capacity: 8, isActive: true },
    { roomNumber: "R104", name: "İstikbal", capacity: 8, isActive: true },
  ];

  const rooms = [];
  for (const r of roomList) {
    const rm = await prisma.room.upsert({
      where: { roomNumber: r.roomNumber },
      update: { name: r.name, capacity: r.capacity, isActive: r.isActive },
      create: r,
    });
    rooms.push(rm);
  }

  // 4. Aktif Sözleşme (v1.0) ve Dinamik Kurallar
  const agreementContent = `1. Maksimum Rezervasyon Süresi ve Günlük Hak
Çalışma odaları günde yalnızca 1 (bir) defa ve en fazla 3 saat süreyle rezerve edilebilir. Süre uzatması yapılmaz. Aynı grubun veya üyelerin farklı isimlerle ardışık rezervasyon yapması yasaktır. Gece 21:00-24:00 saatleri arasına randevu alan kullanıcılar, ertesi gün 00:00-08:00 saatleri arasına randevu alamazlar.

2. Kapı QR Kodu, Kişiye Özel Yoklama ve Gelmeme (No-Show)
Oda girişlerinde bulunan QR kod okutularak randevu başlangıç saatinden ±15 dakika içinde en az 2 grup üyesinin kendi mobil cihazından onay vermesi zorunludur. Başlangıç saatine 1 saatten az kalan randevular iptal edilemez. Randevusuna gelmeyen kullanıcılara e-posta ile uyarı gönderilir; 3 uyarı sonunda kullanıcı dönemsel/30 günlük rezervasyon yasağı (ban) alır.

3. Sessizlik ve Kullanım Kuralları
Kullanıcılar akademik çalışmaya uygun sessiz bir ortam sağlamalıdır. Yüksek sesli konuşmalar, kulaklıksız müzik veya rahatsız edici davranışlara izin verilmez. Temizliği korumak için (kapalı şişedeki su hariç) yiyecek ve içecek tüketimi kesinlikle yasaktır.

4. Ekipman Sorumluluğu
Kullanıcılar rezervasyon süresince kütüphane mülküne, mobilyalara veya teknik ekipmanlara verilen her türlü hasardan sorumludur. Kütüphane ekipmanlarının fişini çekmeyiniz. Lütfen odaya girdiğinizde mevcut sorunları derhal bildirin.

5. Grup Çalışması ve Davet Onay Süresi
Çalışma odaları grup çalışması (en az 2 kişi, en fazla 8 kişi) için tasarlanmıştır. Gönderilen grup davetiyeleri 30 dakika içinde onaylanmalıdır; aksi takdirde rezervasyon otomatik olarak iptal edilir.

6. İleri Tarih Sınırı ve Erken Boşaltma
Rezervasyonlar en fazla 1 gün sonrasına alınabilir. Çalışmasını erken tamamlayan gruplar randevu süresi içinde sistem üzerinden 'Odayı Erken Boşalt' işlemini yaparak odayı diğer öğrencilerin kullanımına açabilirler.`;

  await prisma.agreement.updateMany({ data: { isActive: false } });
  await prisma.agreement.upsert({
    where: { version: "v1.0" },
    update: { title: "Kullanım Kuralları", content: agreementContent, isActive: true },
    create: { title: "Kullanım Kuralları", version: "v1.0", isActive: true, content: agreementContent },
  });

  const rules = [
    { ruleName: "MIN_PARTICIPANTS", ruleType: "INTEGER", ruleValue: { value: 2 } },
    { ruleName: "MAX_PARTICIPANTS", ruleType: "INTEGER", ruleValue: { value: 8 } },
    { ruleName: "MAX_DURATION_HOURS", ruleType: "INTEGER", ruleValue: { value: 3 } },
    { ruleName: "MAX_ADVANCE_DAYS", ruleType: "INTEGER", ruleValue: { value: 1 } },
    { ruleName: "DAILY_RELEASE_HOUR", ruleType: "INTEGER", ruleValue: { value: 8 } },
    { ruleName: "CHECKIN_TOLERANCE_MINUTES", ruleType: "INTEGER", ruleValue: { value: 15 } },
    { ruleName: "CANCEL_LOCK_MINUTES", ruleType: "INTEGER", ruleValue: { value: 60 } },
  ];

  for (const rule of rules) {
    await prisma.reservationRule.upsert({
      where: { ruleName: rule.ruleName },
      update: { ruleValue: rule.ruleValue, ruleType: rule.ruleType, isActive: true },
      create: { ruleName: rule.ruleName, ruleType: rule.ruleType, ruleValue: rule.ruleValue, isActive: true },
    });
  }

  // 5. ZENGİN REZERVASYON VERİ SETİ
  const trHourParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const nowHour = Number(trHourParts.find((p) => p.type === "hour").value);

  const boraStartH = Math.min(20, Math.max(8, nowHour));
  const boraEndH = boraStartH + 2;
  const nextHour = Math.min(21, boraStartH + 1);

  const sampleReservations = [
    { dayOffset: -6, roomIdx: 0, orgIdx: 1, partIdxs: [8, 14, 6], startH: 0, endH: 3, status: "COMPLETED", purpose: "Gece Aerodinamik Hesaplama Grubu" },
    { dayOffset: -6, roomIdx: 1, orgIdx: 2, partIdxs: [9, 16, 10], startH: 3, endH: 6, status: "COMPLETED", purpose: "Yazılım Mimarisi Gece Kampı" },
    { dayOffset: -6, roomIdx: 2, orgIdx: 6, partIdxs: [11, 5], startH: 6, endH: 9, status: "COMPLETED", purpose: "Sabah Meteoroloji ve Seyrüsefer" },
    { dayOffset: -6, roomIdx: 3, orgIdx: 3, partIdxs: [13, 7], startH: 9, endH: 12, status: "COMPLETED", purpose: "Elektromanyetik Alanlar Çalışması" },

    { dayOffset: -5, roomIdx: 0, orgIdx: 0, partIdxs: [1, 7, 10, 2], startH: 10, endH: 13, status: "COMPLETED", purpose: "Algoritma Analizi Proje Çalışması" },
    { dayOffset: -5, roomIdx: 1, orgIdx: 2, partIdxs: [9, 16], startH: 13, endH: 16, status: "COMPLETED", purpose: "Dağıtık Sistemler Sunum Hazırlığı" },
    { dayOffset: -5, roomIdx: 2, orgIdx: 5, partIdxs: [12, 6], startH: 15, endH: 18, status: "COMPLETED", purpose: "Tedarik Zinciri Optimizasyonu" },
    { dayOffset: -5, roomIdx: 3, orgIdx: 8, partIdxs: [14, 1], startH: 18, endH: 21, status: "COMPLETED", purpose: "Uzay Mekaniği Yörünge Analizi" },

    { dayOffset: -4, roomIdx: 0, orgIdx: 1, partIdxs: [8, 14], startH: 9, endH: 12, status: "COMPLETED", purpose: "Aerodinamik Rüzgar Tüneli Raporu" },
    { dayOffset: -4, roomIdx: 1, orgIdx: 10, partIdxs: [7, 0, 9], startH: 12, endH: 15, status: "COMPLETED", purpose: "Yapay Zeka ve Makine Öğrenmesi" },
    { dayOffset: -4, roomIdx: 2, orgIdx: 5, partIdxs: [12, 3], startH: 14, endH: 17, status: "COMPLETED", purpose: "Yöneylem Araştırması Vaka Analizi" },
    { dayOffset: -4, roomIdx: 3, orgIdx: 6, partIdxs: [11, 1], startH: 21, endH: 24, status: "COMPLETED", purpose: "Gece Uçuş Planlama Simülasyonu" },

    { dayOffset: -3, roomIdx: 0, orgIdx: 7, partIdxs: [10, 2], startH: 8, endH: 11, status: "COMPLETED", purpose: "Siber Güvenlik Ağ Analizi" },
    { dayOffset: -3, roomIdx: 1, orgIdx: 0, partIdxs: [2, 7, 9], startH: 11, endH: 14, status: "COMPLETED", purpose: "Veritabanı Yönetim Sistemleri" },
    { dayOffset: -3, roomIdx: 2, orgIdx: 4, partIdxs: [15], startH: 14, endH: 17, status: "NO_SHOW", purpose: "Termodinamik Grup Çalışması", noShow: true, penaltyApplied: true },
    { dayOffset: -3, roomIdx: 3, orgIdx: 13, partIdxs: [3, 15], startH: 17, endH: 20, status: "COMPLETED", purpose: "Mikroişlemciler Lab Hazırlığı" },

    { dayOffset: -2, roomIdx: 0, orgIdx: 3, partIdxs: [13, 7], startH: 10, endH: 13, status: "COMPLETED", purpose: "Sayısal Tasarım Laboratuvarı" },
    { dayOffset: -2, roomIdx: 1, orgIdx: 14, partIdxs: [8, 1, 6], startH: 13, endH: 16, status: "COMPLETED", purpose: "Hava Aracı Yapıları" },
    { dayOffset: -2, roomIdx: 2, orgIdx: 16, partIdxs: [9, 2], startH: 16, endH: 19, status: "COMPLETED", purpose: "Mobil Uygulama Geliştirme" },
    { dayOffset: -2, roomIdx: 3, orgIdx: 4, partIdxs: [15], startH: 19, endH: 22, status: "NO_SHOW", purpose: "Mukavemet Soru Çözümü", noShow: true, penaltyApplied: true },

    { dayOffset: -1, roomIdx: 0, orgIdx: 1, partIdxs: [8, 14, 6], startH: 10, endH: 13, status: "COMPLETED", purpose: "Uçak Yapıları ve Malzeme" },
    { dayOffset: -1, roomIdx: 1, orgIdx: 2, partIdxs: [0, 9, 10], startH: 13, endH: 16, status: "COMPLETED", purpose: "Full-Stack Web Geliştirme Toplantısı" },
    { dayOffset: -1, roomIdx: 2, orgIdx: 5, partIdxs: [12, 11], startH: 16, endH: 19, status: "COMPLETED", purpose: "Mühendislik Ekonomisi Projesi" },
    { dayOffset: -1, roomIdx: 3, orgIdx: 6, partIdxs: [11, 8], startH: 20, endH: 23, status: "COMPLETED", purpose: "Gece Vize Çalışma Grubu" },

    // BUGÜN
    { dayOffset: 0, roomIdx: 0, orgIdx: 9, partIdxs: [16], startH: 2, endH: 5, status: "COMPLETED", purpose: "Gece Kodlama Maratonu" },
    { dayOffset: 0, roomIdx: 0, orgIdx: 10, partIdxs: [7], startH: 5, endH: 8, status: "COMPLETED", purpose: "Sabah Veri Yapıları Tekrarı" },
    {
      dayOffset: 0,
      roomIdx: 0,
      orgIdx: 0,
      partIdxs: [2],
      startH: boraStartH,
      endH: boraEndH,
      status: "CONFIRMED",
      purpose: "Bilgisayar Müh. Bitirme Projesi Grup Çalışması",
    },

    { dayOffset: 0, roomIdx: 1, orgIdx: 1, partIdxs: [14], startH: 6, endH: 9, status: "COMPLETED", purpose: "Sabah Aerodinamik Etüdü" },
    {
      dayOffset: 0,
      roomIdx: 1,
      orgIdx: 8,
      partIdxs: [14, 6],
      startH: boraStartH,
      endH: boraEndH,
      status: "CHECKED_IN",
      purpose: "İtki Sistemleri Tasarımı (Şu An Odada Aktif Grup)",
    },
    { dayOffset: 0, roomIdx: 1, orgIdx: 3, partIdxs: [13], startH: 21, endH: 24, status: "CONFIRMED", purpose: "Gece Devre Analizi Grubu" },

    { dayOffset: 0, roomIdx: 2, orgIdx: 5, partIdxs: [12], startH: 7, endH: 10, status: "COMPLETED", purpose: "Endüstri 4.0 Vaka Çalışması" },
    {
      dayOffset: 0,
      roomIdx: 2,
      orgIdx: 4,
      partIdxs: [15, 13],
      startH: nextHour,
      endH: Math.min(24, nextHour + 2),
      status: "CONFIRMED",
      purpose: "Caner'in Randevusu (3/3 No-Show Oto-Ban Testi)",
    },

    { dayOffset: 0, roomIdx: 3, orgIdx: 6, partIdxs: [11], startH: 4, endH: 7, status: "COMPLETED", purpose: "Sabah Uçuş Teorisi" },
    {
      dayOffset: 0,
      roomIdx: 3,
      orgIdx: 11,
      partIdxs: [12, 16],
      startH: nextHour,
      endH: Math.min(24, nextHour + 2),
      status: "CONFIRMED",
      purpose: "Uçuş Simülasyon ve Kontrol Grubu",
    },

    // YARIN
    {
      dayOffset: 1,
      roomIdx: 1,
      orgIdx: 1,
      partIdxs: [0],
      startH: 10,
      endH: 13,
      status: "PENDING",
      purpose: "Yarınki Disiplinlerarası Havacılık & Yazılım Toplantısı",
    },
  ];

  for (const item of sampleReservations) {
    const orgUser = students[item.orgIdx];
    const room = rooms[item.roomIdx];

    await prisma.reservation.create({
      data: {
        roomId: room.id,
        userId: orgUser.id,
        reservationDate: getDateOffset(item.dayOffset),
        startTime: getTimeUTC(item.startH),
        endTime: item.endH >= 24 ? getTimeUTC(23, 59, 59) : getTimeUTC(item.endH),
        purpose: item.purpose,
        status: item.status,
        noShow: Boolean(item.noShow),
        penaltyApplied: Boolean(item.penaltyApplied),
        checkedInAt: item.status === "CHECKED_IN" || item.status === "COMPLETED" ? new Date() : null,
        checkedInById: item.status === "CHECKED_IN" || item.status === "COMPLETED" ? orgUser.id : null,
        participants: {
          create: item.partIdxs.map((pIdx, idx) => ({
            userId: students[pIdx].id,
            status: item.status === "PENDING" && idx === 0 ? "PENDING" : "ACCEPTED",
            joinedAt: new Date(),
          })),
        },
      },
    });
  }

  // 6. Ceza Kayıtları (R103 - Hürkuş olarak güncellendi)
  const caner = students[4];
  const hakan = students[17];

  await prisma.penaltyHistory.createMany({
    data: [
      { userId: caner.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "R103 - Hürkuş odası rezervasyonuna gelinmedi (1. Uyarı).", isActive: true },
      { userId: caner.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "R104 - İstikbal odası rezervasyonuna gelinmedi (2. Uyarı - Sınırda!).", isActive: true },
      { userId: hakan.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "1. No-Show Uyarısı", isActive: true },
      { userId: hakan.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "2. No-Show Uyarısı", isActive: true },
      { userId: hakan.id, penaltyType: "NO_SHOW", penaltyPoints: 15, description: "3. No-Show Uyarısı (Otomatik 30 Gün Ban)", isActive: true },
    ],
  });

  // 7. Duyurular (Farklı Öncelik Seviyelerinde 5 Örnek Duyuru - Sayfalama ve Filtreleme İçin)
  await prisma.announcement.createMany({
    data: [
      {
        title: {
          tr: "7/24 Grup Çalışma Odaları ve Kapı QR Sistemi Aktif Edildi",
          en: "24/7 Group Study Rooms and Door QR System is Now Active",
        },
        content: {
          tr: "Kütüphanemiz 7/24 hizmet vermektedir. Oda girişlerindeki ortak QR kodu okutarak randevu başlangıcından ±15 dakika içinde onay vermeniz zorunludur.",
          en: "Our library is open 24/7. Please scan the door QR code within ±15 minutes of your start time to confirm check-in.",
        },
        priority: "URGENT",
        isPinned: true,
        isActive: true,
        createdBy: adminUser.id,
        publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
      {
        title: {
          tr: "R103 - Hürkuş Çalışma Odası Yenilendi",
          en: "R103 - Hürkuş Study Room Renovated",
        },
        content: {
          tr: "R103 numaralı çalışma odamız 'Hürkuş' adıyla 8 kişilik yeni masa düzeni ve güç üniteleriyle kullanıma açılmıştır.",
          en: "Study room R103 has been reopened under the name 'Hürkuş' with an 8-person layout and power outlets.",
        },
        priority: "HIGH",
        isPinned: true,
        isActive: true,
        createdBy: adminUser.id,
        publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        title: {
          tr: "Grup Davet Onay Süresi (30 Dakika) Hakkında",
          en: "About Group Invitation Approval Window (30 Minutes)",
        },
        content: {
          tr: "Oluşturulan oda taleplerinin kesinleşmesi için en az 1 davetlinin 30 dakika içinde daveti kabul etmesi gerekmektedir.",
          en: "At least 1 invited participant must accept the invitation within 30 minutes for the reservation to be confirmed.",
        },
        priority: "MEDIUM",
        isPinned: false,
        isActive: true,
        createdBy: superAdmin.id,
        publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      },
      {
        title: {
          tr: "Odayı Erken Boşaltma Özelliği Devrede",
          en: "Early Check-Out Feature is Active",
        },
        content: {
          tr: "Çalışmasını erken tamamlayan gruplar 'Rezervasyonlarım' sayfasından 'Odayı Erken Boşalt' butonuna basarak kalan süreyi diğer öğrencilere açabilirler.",
          en: "Groups finishing early can click 'Early Check-Out' on the 'My Bookings' page to free up the room for other students.",
        },
        priority: "LOW",
        isPinned: false,
        isActive: true,
        createdBy: adminUser.id,
        publishedAt: new Date(Date.now() - 16 * 60 * 60 * 1000),
      },
    ],
  });

  // 8. 15 Öğrenci Logu + 15 Yönetici Logu
  for (let i = 0; i < 15; i++) {
    const st = students[i % students.length];
    const rm = rooms[i % rooms.length];
    await prisma.auditLog.create({
      data: {
        userId: st.id,
        action: i % 3 === 0 ? "RESERVATION_CREATED" : i % 3 === 1 ? "INVITATION_ACCEPTED" : "RESERVATION_CHECKED_IN",
        entityType: "Reservation",
        newData: {
          room: `${rm.roomNumber} - ${rm.name}`,
          date: getDateOffset(-1).toISOString().split("T")[0],
          time: "10:00 - 13:00",
          organizer: st.email,
          invitedParticipants: [students[(i + 1) % students.length].email],
          progress: "2/2",
        },
      },
    });
  }

  for (let i = 0; i < 15; i++) {
    await prisma.adminAction.create({
      data: {
        adminId: i % 2 === 0 ? adminUser.id : superAdmin.id,
        actionType: i % 3 === 0 ? "RESERVATION_FORCE_CHECKIN" : i % 3 === 1 ? "ROOM_UPDATED" : "PENALTY_ADDED",
        targetEntityType: "Reservation",
        description:
          i % 3 === 0
            ? `R10${(i % 4) + 1} odası için görevli tarafından manuel check-in onaylandı.`
            : i % 3 === 1
            ? `R10${(i % 4) + 1} çalışma odası kapasitesi 8 kişi olarak güncellendi.`
            : `Kiosk kodu girmeyen öğrenciye 1/3 No-Show uyarısı ve bilgilendirme e-postası gönderildi.`,
      },
    });
  }

  console.log("✅ Zengin Analitik Seed Tamamlandı! R103 Hürkuş, 4 farklı öncelikte duyuru ve analiz verileri yüklendi.");
}

main()
  .catch((e) => {
    console.error("❌ Seed Hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });