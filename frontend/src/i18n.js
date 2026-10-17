import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Çeviri metinleri
const resources = {
  en: {
    translation: {
      // Genel
      universityName: "University of Turkish Aeronautical Association",
      systemName: "Library Study Room Reservation System",
      secureAccess: "Secure access with Microsoft account",
      signInMicrosoft: "Sign in with Microsoft",
      onlyInstitutional: "Only institutional Microsoft accounts are allowed.",
      dataProtected: "Your data is protected.",
      footerRights: "© 2026 University of Turkish Aeronautical Association. All rights reserved.",
      loginTitle: "Login",
      
      // Kurallar Sayfası
      rulesTitle: "Study Room Reservation Rules",
      rulesSubtitle: "Please read these critical guidelines carefully to ensure a productive and compliant study experience. Your understanding is vital.",
      
      rule1Title: "Maximum Reservation Time",
      rule1Desc: "Study rooms can be reserved for a maximum of 2 hours per day per student group to ensure fair access for all cadets. Extensions are strictly subject to availability and must be requested at the front desk 15 minutes prior to session expiry. Consecutive bookings by the same group under different names are prohibited.",
      
      rule2Title: "Lateness / No-Show Policy",
      rule2Desc: "Reservations will be automatically cancelled if the room is not occupied within 15 minutes of the start time. The room will then be made available to other students. Repeated no-shows (more than 3 times in a semester) may result in a temporary suspension of reservation privileges for up to 30 days.",
      
      rule3Title: "Silence and Usage Rules",
      rule3Desc: "Users must maintain a quiet environment suitable for academic study. Loud conversations, music without headphones, or disruptive behavior is not permitted. Food and beverages (except for water in sealed bottles) are strictly prohibited inside the study rooms to maintain cleanliness.",
      
      rule4Title: "Equipment Responsibility",
      rule4Desc: "Users are responsible for any damage to library property, furniture, or technical equipment during their reservation period. Do not unplug library equipment. Please report any pre-existing issues immediately upon entering the room to avoid liability.",
      
      rule5Title: "Group Study",
      rule5Desc: "Study rooms are intended for group study (minimum 2 people). Individual students should use the general reading hall areas. Single occupants in group study rooms may be asked to vacate the room if a group requires the space.",
      
      // Agreement
      agreementLoading: "Loading agreement...",
      agreementNotFound: "No active agreement found. Please contact the administration.",
      agreementError: "Failed to load the agreement. Please try again.",

      // Footer Aksiyonları
      iRead: "I have read and understood the agreement above",
      byContinuing: "By continuing, you agree to comply with the terms and conditions listed above.",
      logout: "Log out",
      continueBtn: "I Understand & Continue",

      // Dashboard - Navbar
      navUniversity: "THK University",
      navSystem: "Room Reservation System",
      studentId: "Student ID",

      // Dashboard - Welcome
      welcomeBack: "Welcome back, {{name}}",
      welcomeSubtitle: "Manage your study sessions and check library availability.",
      libraryCloses: "Library closes at {{time}} today",

      // Dashboard - Quick Actions
      quickActions: "Quick Actions",
      reserveRoom: "Reserve a Room",
      reserveRoomDesc: "Find a quiet space now.",
      bookNow: "Book Now",
      myReservations: "My Reservations",
      myReservationsDesc: "Active & past bookings.",
      reservationRules: "Reservation Rules",
      reservationRulesDesc: "Read library policies.",

      // Dashboard - Active Reservation
      activeReservation: "Active Reservation",
      happeningNow: "Happening Now",
      until: "Until {{time}}",
      people: "{{count}} People",
      wifiAvailable: "Wi-Fi Available",
      checkIn: "Check In",
      cancel: "Cancel",
      minutesLeft: "Minutes Left",

      // Dashboard - Upcoming Reservations
      upcomingReservations: "Upcoming Reservations",
      viewAll: "View All",
      pendingApproval: "Pending Approval",
      confirmed: "Confirmed",

      // Dashboard - Announcements
      announcements: "Announcements",
      announcementTitle1: "Exam Period Extended Hours",
      announcementDesc1: "Starting next week, the main library will be open 24/7 for the mid-term exam period.",
      announcementTime1: "2 hours ago",
      announcementTitle2: "System Maintenance",
      announcementDesc2: "Reservation system will be offline for maintenance on Sunday from 02:00 to 04:00 AM.",
      announcementTime2: "1 day ago",
      viewAllNotices: "View All Notices",
      noAnnouncements: "No announcements at this time.",

      // Dashboard - Weekly Summary
      rdTitle: "Room Occupancy Today",
      rdAverage: "Avg: {{pct}}%",
      rdBooked: "{{hours}}h / {{total}}h booked",
      rdNoData: "No occupancy data available.",
      rdLow: "Low (<40%)",
      rdMedium: "Medium (40-75%)",
      rdHigh: "High (>75%)",

      // Profile Page
      profileEmail: "Email",
      profileStudentNo: "Student No",
      profileDepartment: "Department",
      profilePhone: "Phone",
      profileMemberSince: "Member Since",
      profilePhoneMissing: "Please add your phone number for reservation notifications.",
      profileUpdatePhone: "Phone Number",
      profileUpdatePhoneDesc: "Used for reservation reminders and urgent notifications.",
      profileSaveBtn: "Save",
      profileSaved: "Profile updated successfully.",
      profileSaveError: "Failed to update profile.",
      profileLoadError: "Could not load profile data.",

      // User Menu
      settings: "Settings",
      profile: "Profile",
      darkMode: "Dark Mode",
      language: "Language",
      logoutConfirm: "Are you sure you want to log out?",

      // Invitations
      pendingInvitations: "Pending Invitations",
      noInvitations: "No pending invitations.",
      invitedYouTo: "{{name}} invited you to room {{room}}",
      inviteDate: "{{date}}, {{start}} – {{end}}",
      accept: "Accept",
      reject: "Reject",
      inviteAccepted: "Invitation accepted!",
      inviteRejected: "Invitation rejected.",

      // Active Reservations (dynamic)
      myActiveReservations: "My Reservations",
      noActiveReservations: "You have no active reservations.",
      youCreated: "You created",
      youJoined: "You joined",
      participantsCount: "{{count}} participants",

      // Dashboard - Footer
      privacyPolicy: "Privacy Policy",
      termsOfUse: "Terms of Use",
      helpCenter: "Help Center",
      footerCopyright: "© 2026 THK University",

      // Navigation
      navDashboard: "Dashboard",
      navStudyRooms: "Study Rooms",
      navMyBookings: "My Bookings",

      // Study Rooms - Filters
      srFilterCriteria: "Filter Criteria",
      srFilterSubtitle: "Select a date and time range to see available rooms.",
      srFiltersAndDate: "Filters & Date",
      srReservationDate: "Reservation Date",
      srTimeDuration: "Reservation Duration",
      srOneHour: "1 Hour",
      srTwoHours: "2 Hours",
      srThreeHours: "3 Hours",
      srTimeRange: "Time Range",
      srTimeRangeLabel: "{{start}} – {{end}}",
      srUpdateResults: "Search Rooms",
      srRulesInfoTitle: "Reservation Rules",
      srRulesInfo: "Each room holds up to {{maxCapacity}} people. Maximum reservation duration is {{maxHours}} hours. You can make 1 reservation per day.",

      // Study Rooms - Room List
      srAvailableRooms: "Available Rooms",
      srShowingRooms: "Showing {{count}} rooms matching your criteria for",
      srMaxBooking: "Max booking duration: {{hours}} hours",
      srCapacity: "Up to {{count}} people",
      srSlotsFree: "{{count}} Slots Free",
      srSlotsLeft: "{{count}} Slots Left",
      srStarting: "Starting {{time}}",
      srTimeOnly: "{{range}} Only",
      srFullyBooked: "Fully Booked",
      srNextAvailable: "Next: {{when}}",
      srTomorrow: "Tomorrow",
      srSelect: "Select",
      srCheck: "Check",
      srUnavailable: "Unavailable",
      srAvailable: "AVAILABLE",
      srLimited: "LIMITED",
      srBooked: "BOOKED",
      srNoRooms: "No rooms match your criteria. Try adjusting your filters.",
      srFetchError: "An error occurred while loading rooms.",

      // Reserve Form - Time Selection
      rfCapacity: "{{count}} People",
      rfBackToRooms: "Back to Rooms",
      rfAvailable: "Available",
      rfSelected: "Selected",
      rfReserved: "Reserved",
      rfPast: "Past",
      rfYourSelection: "Your Selection",
      rfSelectEnd: "Select end time",
      rfSelectedReservation: "Selected Reservation",
      rfContinue: "Confirm Reservation",
      rfReservationPolicy: "Reservations: Mon-Sun. Max <strong>{{hours}} hours</strong> per booking.",
      rfBack: "Back",

      // Reserve Form - Participants
      rfParticipantsTitle: "Add Participants",
      rfParticipantsSubtitle: "Manage attendees for your study session in <strong>{{room}}</strong>.",
      rfStepIndicator: "Step {{current}} of {{total}}",
      rfDate: "Date",
      rfTime: "Time",
      rfRoom: "Room",
      rfRoomCapacity: "Room Capacity",
      rfSeatsFilled: "{{count}} / {{max}} Seats Filled",
      rfCapacityPolicy: "Maximum capacity is strictly enforced by library policy.",
      rfAddParticipant: "Add Participant",
      rfEmailPlaceholder: "Enter institutional email (@thk.edu)",
      rfAdd: "Add",
      rfCurrentAttendees: "Current Attendees ({{count}})",
      rfOrganizer: "Organizer",
      rfParticipant: "Participant",
      rfCannotRemove: "Cannot remove",
      rfPurpose: "Purpose (Optional)",
      rfPurposePlaceholder: "e.g. Group study, Project meeting...",
      rfConfirm: "Continue to Confirmation",
      rfSubmitting: "Creating...",
      rfSuccess: "Reservation created successfully! Waiting for participants' approval.",
      rfMinMaxError: "Total participants must be between {{min}} and {{max}}.",
      rfMissingEmails: "The following e-mails are not registered in the system:",
      rfOverlap: "This room is already reserved for the selected date and time range.",
      rfBackToTime: "Back to Time Selection"
    }
  },
  tr: {
    translation: {
      // Genel
      universityName: "Türk Hava Kurumu Üniversitesi",
      systemName: "Kütüphane Çalışma Odası Rezervasyon Sistemi",
      secureAccess: "Microsoft hesabı ile güvenli erişim",
      signInMicrosoft: "Microsoft ile Giriş Yap",
      onlyInstitutional: "Sadece kurumsal Microsoft hesaplarına izin verilir.",
      dataProtected: "Verileriniz koruma altındadır.",
      footerRights: "© 2026 Türk Hava Kurumu Üniversitesi. Tüm hakları saklıdır.",
      loginTitle: "Giriş Yap",

      // Kurallar Sayfası
      rulesTitle: "Çalışma Odası Rezervasyon Kuralları",
      rulesSubtitle: "Verimli ve kurallara uygun bir çalışma deneyimi sağlamak için lütfen bu kritik yönergeleri dikkatlice okuyun. Anlayışınız hayati önem taşımaktadır.",
      
      rule1Title: "Maksimum Rezervasyon Süresi",
      rule1Desc: "Tüm öğrencilere adil erişim sağlamak için çalışma odaları günde en fazla 2 saat rezerve edilebilir. Süre uzatmaları müsaitlik durumuna bağlıdır ve süre dolmadan 15 dakika önce danışmadan talep edilmelidir. Aynı grubun farklı isimlerle ardışık rezervasyon yapması yasaktır.",
      
      rule2Title: "Geç Kalma / Gelmeme (No-Show)",
      rule2Desc: "Başlangıç saatinden itibaren 15 dakika içinde odaya giriş yapılmazsa rezervasyon otomatik olarak iptal edilir ve oda diğer öğrencilerin kullanımına açılır. Tekrarlanan gelmeme durumları (dönem içinde 3 kezden fazla), rezervasyon ayrıcalıklarının 30 güne kadar askıya alınmasına neden olabilir.",
      
      rule3Title: "Sessizlik ve Kullanım Kuralları",
      rule3Desc: "Kullanıcılar akademik çalışmaya uygun sessiz bir ortam sağlamalıdır. Yüksek sesli konuşmalar, kulaklıksız müzik veya rahatsız edici davranışlara izin verilmez. Temizliği korumak için (kapalı şişedeki su hariç) yiyecek ve içecek tüketimi kesinlikle yasaktır.",
      
      rule4Title: "Ekipman Sorumluluğu",
      rule4Desc: "Kullanıcılar rezervasyon süresince kütüphane mülküne, mobilyalara veya teknik ekipmanlara verilen her türlü hasardan sorumludur. Kütüphane ekipmanlarının fişini çekmeyiniz. Sorumluluktan kaçınmak için lütfen odaya girdiğinizde mevcut sorunları derhal bildirin.",
      
      rule5Title: "Grup Çalışması",
      rule5Desc: "Çalışma odaları grup çalışması (en az 2 kişi) için tasarlanmıştır. Bireysel çalışan öğrenciler genel okuma salonlarını kullanmalıdır. Odayı tek başına kullanan kişilerden, bir grubun alana ihtiyacı olması durumunda odayı boşaltmaları istenebilir.",
      
      // Agreement
      agreementLoading: "Sözleşme yükleniyor...",
      agreementNotFound: "Aktif bir sözleşme bulunamadı. Lütfen yönetimle iletişime geçin.",
      agreementError: "Sözleşme yüklenirken hata oluştu. Lütfen tekrar deneyin.",

      // Footer Aksiyonları
      iRead: "Yukarıdaki sözleşmeyi okudum ve anladım",
      byContinuing: "Devam ederek, yukarıda listelenen şartları ve koşulları kabul etmiş olursunuz.",
      logout: "Çıkış Yap",
      continueBtn: "Anlıyorum ve Devam Et",

      // Dashboard - Navbar
      navUniversity: "THK Üniversitesi",
      navSystem: "Oda Rezervasyon Sistemi",
      studentId: "Öğrenci No",

      // Dashboard - Welcome
      welcomeBack: "Tekrar hoşgeldin, {{name}}",
      welcomeSubtitle: "Çalışma seanslarınızı yönetin ve kütüphane müsaitliğini kontrol edin.",
      libraryCloses: "Kütüphane bugün {{time}}'da kapanıyor",

      // Dashboard - Quick Actions
      quickActions: "Hızlı İşlemler",
      reserveRoom: "Oda Rezerve Et",
      reserveRoomDesc: "Sessiz bir alan bul.",
      bookNow: "Şimdi Rezerve Et",
      myReservations: "Rezervasyonlarım",
      myReservationsDesc: "Aktif ve geçmiş rezervasyonlar.",
      reservationRules: "Rezervasyon Kuralları",
      reservationRulesDesc: "Kütüphane politikalarını oku.",

      // Dashboard - Active Reservation
      activeReservation: "Aktif Rezervasyon",
      happeningNow: "Şu An Aktif",
      until: "{{time}}'a kadar",
      people: "{{count}} Kişi",
      wifiAvailable: "Wi-Fi Mevcut",
      checkIn: "Giriş Yap",
      cancel: "İptal Et",
      minutesLeft: "Dakika Kaldı",

      // Dashboard - Upcoming Reservations
      upcomingReservations: "Yaklaşan Rezervasyonlar",
      viewAll: "Tümünü Gör",
      pendingApproval: "Onay Bekliyor",
      confirmed: "Onaylandı",

      // Dashboard - Announcements
      announcements: "Duyurular",
      announcementTitle1: "Sınav Dönemi Uzatılmış Saatler",
      announcementDesc1: "Gelecek haftadan itibaren, ana kütüphane vize dönemi boyunca 7/24 açık olacaktır.",
      announcementTime1: "2 saat önce",
      announcementTitle2: "Sistem Bakımı",
      announcementDesc2: "Rezervasyon sistemi Pazar günü 02:00 - 04:00 arası bakım nedeniyle çevrimdışı olacaktır.",
      announcementTime2: "1 gün önce",
      viewAllNotices: "Tüm Duyuruları Gör",
      noAnnouncements: "Şu an güncel bir duyuru bulunmamaktadır.",

      // Dashboard - Weekly Summary
      rdTitle: "Bugünkü Oda Yoğunluğu",
      rdAverage: "Ort: %{{pct}}",
      rdBooked: "{{hours}}s / {{total}}s dolu",
      rdNoData: "Henüz doluluk verisi yok.",
      rdLow: "Düşük (<%40)",
      rdMedium: "Orta (%40-75)",
      rdHigh: "Yüksek (>%75)",

      // Profile Page
      profileEmail: "E-posta",
      profileStudentNo: "Öğrenci No",
      profileDepartment: "Bölüm",
      profilePhone: "Telefon",
      profileMemberSince: "Üyelik Tarihi",
      profilePhoneMissing: "Rezervasyon bilgilendirmeleri için lütfen telefon numaranızı ekleyin.",
      profileUpdatePhone: "Telefon Numarası",
      profileUpdatePhoneDesc: "Rezervasyon hatırlatmaları ve acil bildirimler için kullanılır.",
      profileSaveBtn: "Kaydet",
      profileSaved: "Profil başarıyla güncellendi.",
      profileSaveError: "Profil güncellenirken bir hata oluştu.",
      profileLoadError: "Profil verileri yüklenemedi.",

      // User Menu
      settings: "Ayarlar",
      profile: "Profil",
      darkMode: "Karanlık Mod",
      language: "Dil",
      logoutConfirm: "Çıkış yapmak istediğinize emin misiniz?",

      // Invitations
      pendingInvitations: "Bekleyen Davetlerim",
      noInvitations: "Bekleyen davetiniz yok.",
      invitedYouTo: "{{name}}, sizi {{room}} nolu odaya davet etti",
      inviteDate: "{{date}}, {{start}} – {{end}}",
      accept: "Kabul Et",
      reject: "Reddet",
      inviteAccepted: "Davet kabul edildi!",
      inviteRejected: "Davet reddedildi.",

      // Active Reservations (dynamic)
      myActiveReservations: "Rezervasyonlarım",
      noActiveReservations: "Aktif rezervasyonunuz yok.",
      youCreated: "Oluşturduğunuz",
      youJoined: "Katıldığınız",
      participantsCount: "{{count}} katılımcı",

      // Dashboard - Footer
      privacyPolicy: "Gizlilik Politikası",
      termsOfUse: "Kullanım Koşulları",
      helpCenter: "Yardım Merkezi",
      footerCopyright: "© 2026 THK Üniversitesi",

      // Navigation
      navDashboard: "Ana Sayfa",
      navStudyRooms: "Çalışma Odaları",
      navMyBookings: "Rezervasyonlarım",

      // Study Rooms - Filters
      srFilterCriteria: "Filtre Kriterleri",
      srFilterSubtitle: "Müsait odaları görmek için tarih ve saat aralığı seçin.",
      srFiltersAndDate: "Filtreler ve Tarih",
      srReservationDate: "Rezervasyon Tarihi",
      srTimeDuration: "Rezervasyon Süresi",
      srOneHour: "1 Saat",
      srTwoHours: "2 Saat",
      srThreeHours: "3 Saat",
      srTimeRange: "Saat Aralığı",
      srTimeRangeLabel: "{{start}} – {{end}}",
      srUpdateResults: "Oda Ara",
      srRulesInfoTitle: "Rezervasyon Kuralları",
      srRulesInfo: "Her oda en fazla {{maxCapacity}} kişiliktir. Maksimum rezervasyon süresi {{maxHours}} saattir. Günde 1 rezervasyon yapabilirsiniz.",

      // Study Rooms - Room List
      srAvailableRooms: "Müsait Odalar",
      srShowingRooms: "Kriterlerinize uyan {{count}} oda gösteriliyor, tarih:",
      srMaxBooking: "Maks. rezervasyon süresi: {{hours}} saat",
      srCapacity: "En fazla {{count}} kişi",
      srSlotsFree: "{{count}} Slot Boş",
      srSlotsLeft: "{{count}} Slot Kaldı",
      srStarting: "Başlangıç {{time}}",
      srTimeOnly: "Sadece {{range}}",
      srFullyBooked: "Tamamen Dolu",
      srNextAvailable: "Sonraki: {{when}}",
      srTomorrow: "Yarın",
      srSelect: "Seç",
      srCheck: "Kontrol Et",
      srUnavailable: "Müsait Değil",
      srAvailable: "MÜSAİT",
      srLimited: "SINIRLI",
      srBooked: "DOLU",
      srNoRooms: "Kriterlerinize uyan oda bulunamadı. Filtreleri ayarlamayı deneyin.",
      srFetchError: "Odalar yüklenirken bir hata oluştu.",

      // Reserve Form - Time Selection
      rfCapacity: "{{count}} Kişi",
      rfBackToRooms: "Odalara Dön",
      rfAvailable: "Müsait",
      rfSelected: "Seçili",
      rfReserved: "Dolu",
      rfPast: "Geçmiş",
      rfYourSelection: "Seçiminiz",
      rfSelectEnd: "Bitiş saatini seçin",
      rfSelectedReservation: "Seçilen Rezervasyon",
      rfContinue: "Rezervasyonu Onayla",
      rfReservationPolicy: "Rezervasyonlar: Ptesi-Pazar. Rezervasyon başına maks. <strong>{{hours}} saat</strong>.",
      rfBack: "Geri",

      // Reserve Form - Participants
      rfParticipantsTitle: "Katılımcı Ekle",
      rfParticipantsSubtitle: "<strong>{{room}}</strong> odasındaki çalışma oturumu için katılımcıları yönetin.",
      rfStepIndicator: "Adım {{current}} / {{total}}",
      rfDate: "Tarih",
      rfTime: "Saat",
      rfRoom: "Oda",
      rfRoomCapacity: "Oda Kapasitesi",
      rfSeatsFilled: "{{count}} / {{max}} Koltuk Dolu",
      rfCapacityPolicy: "Maksimum kapasite, kütüphane politikası gereği kesin olarak uygulanır.",
      rfAddParticipant: "Katılımcı Ekle",
      rfEmailPlaceholder: "Kurumsal e-posta girin (@thk.edu)",
      rfAdd: "Ekle",
      rfCurrentAttendees: "Mevcut Katılımcılar ({{count}})",
      rfOrganizer: "Organizatör",
      rfParticipant: "Katılımcı",
      rfCannotRemove: "Kaldırılamaz",
      rfPurpose: "Kullanım Amacı (Opsiyonel)",
      rfPurposePlaceholder: "Örn: Grup çalışması, Proje toplantısı...",
      rfConfirm: "Onaya Devam Et",
      rfSubmitting: "Oluşturuluyor...",
      rfSuccess: "Rezervasyon başarıyla oluşturuldu! Arkadaşlarınızın onayı bekleniyor.",
      rfMinMaxError: "Toplam katılımcı sayısı {{min}} ile {{max}} arasında olmalıdır.",
      rfMissingEmails: "Şu e-postalar sisteme kayıtlı değil:",
      rfOverlap: "Bu oda seçilen tarih ve saat aralığında zaten rezerve edilmiş.",
      rfBackToTime: "Saat Seçimine Dön"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "tr", // Varsayılan dil
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;