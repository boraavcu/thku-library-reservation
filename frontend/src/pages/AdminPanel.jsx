import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Tabs, Tab, Button, Chip,
  Switch, TextField, Select, MenuItem, IconButton, CircularProgress,
  Alert, Snackbar, Divider, Paper, Tooltip, InputAdornment, Pagination,
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import RoomDensityChart from '../components/dashboard/RoomDensityChart';
import api from '../api';

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import GavelIcon from '@mui/icons-material/Gavel';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import SearchIcon from '@mui/icons-material/Search';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RadarIcon from '@mui/icons-material/Radar';
import SchoolIcon from '@mui/icons-material/School';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import InsightsIcon from '@mui/icons-material/Insights';

const THKU_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png';
const STAFF_ROLES = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'];
const ITEMS_PER_PAGE = 10;

const DEPT_EN_MAP = {
  'Bilgisayar Mühendisliği': 'Computer Engineering',
  'Havacılık ve Uzay Mühendisliği': 'Aerospace Engineering',
  'Yazılım Mühendisliği': 'Software Engineering',
  'Elektrik-Elektronik Mühendisliği': 'Electrical & Electronics Eng.',
  'Makine Mühendisliği': 'Mechanical Engineering',
  'Endüstri Mühendisliği': 'Industrial Engineering',
  'Pilotaj': 'Flight Training (Pilotage)',
  'Lojistik Yönetimi': 'Logistics Management',
};

const getFutureDateStr = (daysToAdd) => {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
};

const RULE_META = {
  MIN_PARTICIPANTS: {
    title: 'Minimum Katılımcı Sayısı (Kişi)',
    titleEn: 'Minimum Participants Required',
    desc: 'Bir çalışma odasının rezerve edilebilmesi için gereken en az öğrenci sayısı (Varsayılan: 2 Kişi).',
    descEn: 'Minimum number of students required to book a study room (Default: 2).',
    unit: 'Kişi',
    unitEn: 'People',
    min: 2,
    max: 8,
    step: 1,
  },
  MAX_PARTICIPANTS: {
    title: 'Maksimum Oda Kapasitesi (Kişi)',
    titleEn: 'Maximum Room Capacity',
    desc: 'Bir çalışma odasına aynı anda girebilecek en fazla öğrenci sayısı (Varsayılan: 8 Kişi).',
    descEn: 'Maximum number of students allowed in a study room (Default: 8).',
    unit: 'Kişi',
    unitEn: 'People',
    min: 2,
    max: 16,
    step: 1,
  },
  MAX_DURATION_HOURS: {
    title: 'Günlük Maksimum Rezervasyon Süresi (Saat)',
    titleEn: 'Maximum Daily Booking Duration (Hours)',
    desc: 'Bir grubun günde tek seferde alabileceği en uzun çalışma süresi (Varsayılan: 3 Saat, Uzatma Yok).',
    descEn: 'Maximum study duration per group per day (Default: 3 Hours, No Extensions).',
    unit: 'Saat',
    unitEn: 'Hours',
    min: 1,
    max: 6,
    step: 1,
  },
  MAX_ADVANCE_DAYS: {
    title: 'İleri Tarihli Rezervasyon Sınırı (Gün)',
    titleEn: 'Advance Booking Window (Days)',
    desc: 'Öğrencilerin kaç gün sonrasına kadar rezervasyon yapabileceği (Varsayılan: 1 Gün).',
    descEn: 'How many days in advance students can book a room (Default: 1 Day).',
    unit: 'Gün',
    unitEn: 'Days',
    min: 1,
    max: 14,
    step: 1,
  },
  DAILY_RELEASE_HOUR: {
    title: 'Yeni Gün Kotalarının Açılış Saati',
    titleEn: 'Daily Quota Release Hour',
    desc: 'İleri tarihli yeni gün rezervasyonlarının sabah saat kaçta açılacağı.',
    descEn: 'The morning hour at which new daily booking slots open.',
    unit: ':00',
    unitEn: ':00',
    min: 0,
    max: 23,
    step: 1,
  },
  CHECKIN_TOLERANCE_MINUTES: {
    title: 'Kapı QR Yoklama Tolerans Süresi (± Dakika)',
    titleEn: 'Door QR Check-In Tolerance Window (± Mins)',
    desc: 'Randevu başlangıç saatinden kaç dakika öncesi ve sonrasında kapı QR onayının açık kalacağı (Varsayılan: ±15 Dk).',
    descEn: 'Minutes before and after the start time during which door QR check-in is open (Default: ±15 Mins).',
    unit: 'Dakika',
    unitEn: 'Mins',
    min: 10,
    max: 60,
    step: 5,
  },
  CANCEL_LOCK_MINUTES: {
    title: 'Son İptal Kilidi Süresi (Dakika)',
    titleEn: 'Last-Minute Cancellation Lock (Mins)',
    desc: 'Randevu başlangıcına kaç dakika kala iptal işleminin kilitleneceği (Varsayılan: 60 Dk / 1 Saat).',
    descEn: 'Minutes before start time when cancellation is locked (Default: 60 Mins / 1 Hour).',
    unit: 'Dakika',
    unitEn: 'Mins',
    min: 15,
    max: 180,
    step: 15,
  },
};

function formatAuditLog(log, isEn) {
  const actor = log.user?.fullName || log.user?.email || (isEn ? 'System / Student' : 'Sistem / Öğrenci');
  const d = log.newData || {};
  const old = log.oldData || {};

  switch (log.action) {
    case 'RESERVATION_CREATED':
      return {
        badge: isEn ? 'New Booking' : 'Yeni Rezervasyon',
        color: 'primary',
        title: isEn
          ? `${actor} created a new group study room reservation.`
          : `${actor} yeni bir grup çalışma odası rezervasyonu oluşturdu.`,
        detail: isEn
          ? `Room: ${d.room || '-'} | Date: ${d.date || '-'} | Time: ${d.time || '-'} | Invited: ${(d.invitedParticipants || []).join(', ') || 'None'}`
          : `Oda: ${d.room || '-'} | Tarih: ${d.date || '-'} | Saat: ${d.time || '-'} | Davet Edilenler: ${(d.invitedParticipants || []).join(', ') || 'Yok'}`,
      };
    case 'RESERVATION_CHECKED_IN':
      return {
        badge: isEn ? 'Door QR Check-In' : 'Kişisel Kiosk Girişi',
        color: 'success',
        title: isEn
          ? `${actor} completed personal verification via the door QR code.`
          : `${actor} kapı QR kodundan kişisel doğrulama onayı vererek yoklamasını tamamladı.`,
        detail: isEn
          ? `Room: ${d.room || '-'} | Verified By: ${d.checkedInBy || actor} | Group Progress: ${d.progress || '-'}`
          : `Oda: ${d.room || '-'} | Doğrulayan: ${d.checkedInBy || actor} | Grup İlerlemesi: ${d.progress || '-'}`,
      };
    case 'RESERVATION_CANCELLED':
      return {
        badge: isEn ? 'Cancelled' : 'İptal Edildi',
        color: 'error',
        title: isEn ? `${actor} cancelled the reservation.` : `${actor} rezervasyonu iptal etti.`,
        detail: isEn
          ? `Room: ${old.room || '-'} | Reason: ${d.reason || 'User cancellation'}`
          : `Oda: ${old.room || '-'} | Sebep: ${d.reason || 'Kullanıcı iptali'}`,
      };
    case 'RESERVATION_EARLY_CHECKOUT':
      return {
        badge: isEn ? 'Early Check-Out' : 'Erken Boşaltma',
        color: 'info',
        title: isEn
          ? `${actor} finished early and released the room for other students.`
          : `${actor} çalışmasını erken tamamlayarak odayı diğer öğrencilere açtı.`,
        detail: isEn
          ? `Room: ${d.room || '-'} | Released By: ${d.releasedBy || actor}`
          : `Oda: ${d.room || '-'} | İşlemi Yapan: ${d.releasedBy || actor}`,
      };
    case 'INVITATION_ACCEPTED':
      return {
        badge: isEn ? 'Invite Accepted' : 'Davet Kabulü',
        color: 'success',
        title: isEn
          ? `${actor} accepted the group study invitation.`
          : `${actor} kendisine gelen grup çalışma davetini kabul etti.`,
        detail: isEn
          ? `Room: ${d.room || '-'} | Participant: ${d.participantEmail || actor}`
          : `Oda: ${d.room || '-'} | Katılımcı: ${d.participantEmail || actor}`,
      };
    case 'INVITATION_REJECTED':
      return {
        badge: isEn ? 'Invite Rejected' : 'Davet Reddi',
        color: 'warning',
        title: isEn
          ? `${actor} rejected the group study invitation.`
          : `${actor} grup çalışma davetini reddetti.`,
        detail: isEn
          ? `Room: ${d.room || '-'} | Participant: ${d.participantEmail || actor}`
          : `Oda: ${d.room || '-'} | Katılımcı: ${d.participantEmail || actor}`,
      };
    default:
      return {
        badge: log.action,
        color: 'default',
        title: isEn ? `${actor} performed a system action.` : `${actor} sistem üzerinde bir işlem gerçekleştirdi.`,
        detail: `Target: ${log.entityType || '-'}`,
      };
  }
}

export default function AdminPanel() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: session, status } = useSession();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const [tab, setTab] = useState(0);
  const [resFilter, setResFilter] = useState('ACTIVE');
  const [resSearch, setResSearch] = useState('');
  const [resRoomFilter, setResRoomFilter] = useState('ALL');
  const [userSearch, setUserSearch] = useState('');

  const [resPage, setResPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [adminLogPage, setAdminLogPage] = useState(1);

  const [data, setData] = useState({
    rooms: [],
    reservations: [],
    users: [],
    rules: [],
    announcements: [],
    auditLogs: [],
    adminActions: [],
    logRetentionPolicy: null,
    analytics: null,
  });
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const [newRoom, setNewRoom] = useState({ roomNumber: '', name: '', capacity: 8 });
  const [annForm, setAnnForm] = useState({ titleTr: '', titleEn: '', contentTr: '', contentEn: '', priority: 'HIGH' });

  const [editRoomDialog, setEditRoomDialog] = useState({
    open: false,
    roomId: null,
    roomNumber: '',
    name: '',
    capacity: 8,
  });

  const [banDialog, setBanDialog] = useState({
    open: false,
    userId: null,
    fullName: '',
    email: '',
    banMode: 'DATE',
    banUntilDateStr: getFutureDateStr(30),
    banReason: '',
  });

  const userRole = session?.user?.role;
  const isLibrarianOnly = userRole === 'LIBRARIAN';
  const isAdminOrSuper = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get('/admin/manage')
      .then((res) => setData(res.data))
      .catch(() => setSnack({ open: true, message: 'Yönetim verileri yüklenemedi.', severity: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || !STAFF_ROLES.includes(userRole)) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [status, userRole, navigate, fetchData]);

  const runAction = async (action, payload, successMsg) => {
    try {
      const res = await api.post('/admin/manage', { action, payload });
      let finalMsg = successMsg;
      if (res.data?.autoBannedNames?.length > 0) {
        finalMsg = `${successMsg} (3/3 Uyarı dolduğu için otomatik banlananlar: ${res.data.autoBannedNames.join(', ')})`;
      }
      setSnack({ open: true, message: finalMsg, severity: 'success' });
      fetchData();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.error || 'İşlem başarısız oldu.',
        severity: 'error',
      });
    }
  };

  const handlePrintPdfReport = () => {
    setTab(0);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const fmtTime = (tStr) => {
    const d = new Date(tStr);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (h === 23 && m >= 59) return '24:00';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const fmtDate = (dStr) =>
    new Date(dStr).toLocaleDateString(isEn ? 'en-US' : 'tr-TR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const filteredReservations = useMemo(() => {
    const q = resSearch.trim().toLowerCase();

    return (data.reservations || []).filter((r) => {
      if (resFilter === 'ACTIVE' && !['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status)) return false;
      if (resFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false;
      if (resFilter === 'CANCELLED' && !['CANCELLED', 'NO_SHOW'].includes(r.status)) return false;

      if (resRoomFilter !== 'ALL' && r.room?.roomNumber !== resRoomFilter) return false;

      if (q) {
        const orgMatch =
          (r.user?.fullName || '').toLowerCase().includes(q) ||
          (r.user?.email || '').toLowerCase().includes(q) ||
          (r.user?.phone || '').toLowerCase().includes(q) ||
          (r.user?.studentNumber || '').toLowerCase().includes(q) ||
          (r.user?.department || '').toLowerCase().includes(q);

        const roomMatch =
          (r.room?.roomNumber || '').toLowerCase().includes(q) ||
          (r.room?.name || '').toLowerCase().includes(q) ||
          (r.purpose || '').toLowerCase().includes(q);

        const partMatch = (r.participants || []).some(
          (p) =>
            (p.user?.fullName || '').toLowerCase().includes(q) ||
            (p.user?.email || '').toLowerCase().includes(q) ||
            (p.user?.phone || '').toLowerCase().includes(q)
        );

        if (!orgMatch && !roomMatch && !partMatch) return false;
      }

      return true;
    });
  }, [data.reservations, resFilter, resRoomFilter, resSearch]);

  const paginatedReservations = useMemo(() => {
    const start = (resPage - 1) * ITEMS_PER_PAGE;
    return filteredReservations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReservations, resPage]);

  const { studentList, staffList } = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const matches = (u) =>
      !q ||
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.studentNumber || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q);

    return {
      studentList: (data.users || []).filter((u) => u.role === 'STUDENT' && matches(u)),
      staffList: (data.users || []).filter((u) => u.role !== 'STUDENT' && matches(u)),
    };
  }, [data.users, userSearch]);

  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * ITEMS_PER_PAGE;
    return studentList.slice(start, start + ITEMS_PER_PAGE);
  }, [studentList, studentPage]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * ITEMS_PER_PAGE;
    return (data.auditLogs || []).slice(start, start + ITEMS_PER_PAGE);
  }, [data.auditLogs, auditPage]);

  const paginatedAdminLogs = useMemo(() => {
    const start = (adminLogPage - 1) * ITEMS_PER_PAGE;
    return (data.adminActions || []).slice(start, start + ITEMS_PER_PAGE);
  }, [data.adminActions, adminLogPage]);

  if (status === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeBookingsCount = (data.reservations || []).filter((r) => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status)).length;
  const totalStudentsCount = (data.users || []).filter((u) => u.role === 'STUDENT').length;
  const bannedUsersCount = (data.users || []).filter((u) => u.isBanned).length;
  const maxHeatCount = Math.max(1, ...(data.analytics?.hourlyHeatmap?.map((h) => h.count) || [1]));
  const minTomorrowDateStr = getFutureDateStr(1);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        '@media print': {
          bgcolor: '#fff',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        },
      }}
    >
      <Box sx={{ '@media print': { display: 'none' } }}>
        <Navbar />
      </Box>

      <Container
        maxWidth="lg"
        sx={{
          pt: { xs: 2.5, md: 3.5 },
          pb: 6,
          px: { xs: 1.5, sm: 3 },
          flex: 1,
          '@media print': { pt: 1, pb: 1, px: 1, maxWidth: '100%' },
        }}
      >
        {/* Sadece PDF Çıktısında Görünecek Resmi Antet */}
        <Box
          sx={{
            display: 'none',
            '@media print': {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pb: 1.5,
              mb: 2,
              borderBottom: '2px solid #0F172A',
              breakInside: 'avoid',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box component="img" src={THKU_LOGO_URL} alt="THKÜ" sx={{ width: 52, height: 52, objectFit: 'contain' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A', fontSize: '1.05rem' }}>
                {isEn ? 'UNIVERSITY OF TURKISH AERONAUTICAL ASSOCIATION' : 'TÜRK HAVA KURUMU ÜNİVERSİTESİ'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
                {isEn
                  ? 'Directorate of Library & Documentation • Group Study Rooms Activity & Occupancy Report'
                  : 'Kütüphane ve Dokümantasyon Daire Başkanlığı • Grup Çalışma Odaları Faaliyet & Yoğunluk Raporu'}
              </Typography>
            </Box>
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
            {isEn ? 'Report Date:' : 'Rapor Tarihi:'} {new Date().toLocaleDateString(isEn ? 'en-US' : 'tr-TR')}
          </Typography>
        </Box>

        {/* Üst Başlık ve Hızlı Butonlar */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
            '@media print': { display: 'none' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
              <AdminPanelSettingsIcon fontSize="large" />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h4" sx={{ fontWeight: 800, fontSize: { xs: '1.35rem', sm: '1.85rem' } }}>
                  {isEn ? 'Library Management & Analytics Center' : 'Kütüphane Yönetim & Analiz Merkezi'}
                </Typography>
                <Chip label={userRole} color="primary" size="small" sx={{ fontWeight: 700 }} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {isEn
                  ? 'Room management, door QR poster, PDF activity report, scheduled/permanent bans & audit logs'
                  : 'Oda düzenleme, kapı QR posteri, PDF faaliyet raporu, takvimli/kalıcı ban ve denetim paneli'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<PictureAsPdfIcon />}
              onClick={handlePrintPdfReport}
              sx={{ borderRadius: 2, fontWeight: 700, flex: { xs: 1, sm: 'none' } }}
            >
              {isEn ? 'Activity Report (PDF)' : 'Faaliyet Raporu (PDF)'}
            </Button>

            {isLibrarianOnly && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<SchoolIcon />}
                onClick={() => navigate('/dashboard?studentView=true')}
                sx={{ borderRadius: 2, fontWeight: 700, flex: { xs: 1, sm: 'none' } }}
              >
                {isEn ? 'Student View (Book Room)' : 'Öğrenci Ekranı (Rezervasyon Yap)'}
              </Button>
            )}

            <Button
              variant="contained"
              color="secondary"
              startIcon={<QrCodeScannerIcon />}
              onClick={() => navigate('/kiosk')}
              sx={{ borderRadius: 2, fontWeight: 700, flex: { xs: 1, sm: 'none' } }}
            >
              {isEn ? 'Door QR Poster (/kiosk)' : 'Kapı QR Posteri (/kiosk)'}
            </Button>
          </Box>
        </Box>

        {/* Özet KPI Kartları (5 Kart) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(5, 1fr)' },
            gap: 2,
            mb: 3,
            '@media print': {
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 1.25,
              mb: 2,
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
            },
          }}
        >
          <Card sx={{ p: 2, borderLeft: `4px solid ${theme.palette.success.main}`, '@media print': { p: 1.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {isEn ? 'ACTIVE STUDY ROOMS' : 'AKTİF ÇALIŞMA ODASI'}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, fontSize: { xs: '1.5rem', sm: '1.85rem' }, '@media print': { fontSize: '1.35rem' } }}>
              {(data.rooms || []).filter((r) => r.isActive).length} / {(data.rooms || []).length}
            </Typography>
          </Card>

          <Card sx={{ p: 2, borderLeft: `4px solid ${theme.palette.primary.main}`, '@media print': { p: 1.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {isEn ? 'ACTIVE / PENDING BOOKINGS' : 'AKTİF / BEKLEYEN RANDEVU'}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, fontSize: { xs: '1.5rem', sm: '1.85rem' }, '@media print': { fontSize: '1.35rem' } }}>
              {activeBookingsCount}
            </Typography>
          </Card>

          <Card sx={{ p: 2, borderLeft: `4px solid ${theme.palette.warning.main}`, '@media print': { p: 1.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {isEn ? 'PEAK OCCUPANCY HOUR' : 'ZİRVE YOĞUNLUK SAATİ'}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: 'warning.main', fontSize: { xs: '1.5rem', sm: '1.85rem' }, '@media print': { fontSize: '1.35rem' } }}>
              {data.analytics?.peakHour || '14:00'}
            </Typography>
          </Card>

          <Card sx={{ p: 2, borderLeft: `4px solid ${theme.palette.info.main}`, '@media print': { p: 1.25 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {isEn ? 'REGISTERED STUDENTS' : 'KAYITLI ÖĞRENCİ SAYISI'}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: 'info.main', fontSize: { xs: '1.5rem', sm: '1.85rem' }, '@media print': { fontSize: '1.35rem' } }}>
              {totalStudentsCount}
            </Typography>
          </Card>

          <Card sx={{ p: 2, borderLeft: `4px solid ${theme.palette.error.main}`, gridColumn: { xs: 'span 2', sm: 'span 1' }, '@media print': { p: 1.25, gridColumn: 'span 1' } }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {isEn ? 'BANNED STUDENTS' : 'YASAKLI (BANLI) ÖĞRENCİ'}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: 'error.main', fontSize: { xs: '1.5rem', sm: '1.85rem' }, '@media print': { fontSize: '1.35rem' } }}>
              {bannedUsersCount}
            </Typography>
          </Card>
        </Box>

        {/* Ana Yönetim Sekmeleri */}
        <Card sx={{ '@media print': { boxShadow: 'none', border: 'none' } }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              px: { xs: 1, sm: 2 },
              '@media print': { display: 'none' },
            }}
          >
            <Tab icon={<BarChartIcon />} iconPosition="start" label={isEn ? 'Occupancy & Analytics' : 'Yoğunluk & Doluluk Analizi'} />
            <Tab icon={<EventAvailableIcon />} iconPosition="start" label={isEn ? 'Reservations' : 'Rezervasyon Yönetimi'} />
            <Tab icon={<MeetingRoomIcon />} iconPosition="start" label={isEn ? 'Manage Rooms' : 'Odaları Ekle / Düzenle / Sil'} />
            <Tab icon={<CampaignIcon />} iconPosition="start" label={isEn ? 'Announcements' : 'Duyuru Yayınla'} />
            <Tab icon={<PeopleAltIcon />} iconPosition="start" label={isEn ? 'Students, Bans & Roles' : 'Öğrenciler, Ban & Yetkiler'} />
            {isAdminOrSuper && <Tab icon={<GavelIcon />} iconPosition="start" label={isEn ? 'Rules & Logs (180 Days)' : 'Kurallar & Loglar (180 Gün)'} />}
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 }, '@media print': { p: 0 } }}>
            {/* ================= SEKME 0: YOĞUNLUK & DOLULUK ANALİZİ ================= */}
            {tab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, '@media print': { gap: 2 } }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: 2.5,
                    bgcolor: alpha(theme.palette.info.main, 0.06),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.info.main, 0.2),
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <RadarIcon color="info" fontSize="large" />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {isEn
                          ? 'Next 1-Hour Operations Radar (Live Desk & Door QR Tracking)'
                          : 'Gelecek 1 Saat Operasyon Radarı (Canlı Banko & Kapı QR Takibi)'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {isEn ? (
                          <>
                            Currently <strong>{data.analytics?.activeNowRooms || 0} active group(s)</strong> in study rooms. Within the next 60 minutes, <strong>{data.analytics?.upcomingHourReservations || 0} new group(s) ({data.analytics?.upcomingHourStudents || 0} students)</strong> will perform door QR check-in.
                          </>
                        ) : (
                          <>
                            Şu an odalarda aktif <strong>{data.analytics?.activeNowRooms || 0} grup</strong> bulunuyor. Önümüzdeki 60 dakika içinde <strong>{data.analytics?.upcomingHourReservations || 0} yeni grup ({data.analytics?.upcomingHourStudents || 0} öğrenci)</strong> kapı QR doğrulaması yapacak.
                          </>
                        )}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={handlePrintPdfReport}
                    sx={{ '@media print': { display: 'none' } }}
                  >
                    {isEn ? 'Save Page as PDF' : 'Bu Sayfayı PDF Olarak Kaydet'}
                  </Button>
                </Paper>

                {/* FAALİYET RAPORU PERFORMANS KARTLARI */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                    gap: 2,
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                    '@media print': { gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 },
                  }}
                >
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, breakInside: 'avoid' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <InsightsIcon color="success" fontSize="small" />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                        {isEn ? 'BOOKING COMPLETION & DISCIPLINE RATE' : 'RANDEVU GERÇEKLEŞME & DİSİPLİN ORANI'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                      <Chip
                        label={isEn ? `Completed: ${data.analytics?.completionRate ?? 85}%` : `Tamamlanan: %${data.analytics?.completionRate ?? 85}`}
                        color="success"
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                      <Chip
                        label={isEn ? `Cancelled: ${data.analytics?.cancellationRate ?? 8}%` : `İptal: %${data.analytics?.cancellationRate ?? 8}`}
                        color="info"
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                      <Chip
                        label={`No-Show: %${data.analytics?.noShowRate ?? 7}`}
                        color="error"
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    </Box>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, breakInside: 'avoid' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block' }}>
                      {isEn ? 'AVERAGE GROUP SIZE' : 'ORTALAMA GRUP BÜYÜKLÜĞÜ'}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', mt: 0.5 }}>
                      {data.analytics?.avgGroupSize || '3.2'} {isEn ? 'Students / Group' : 'Öğrenci / Grup'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isEn ? 'Based on 2–8 person room capacity' : 'Min 2 – Maks 8 kişilik oda kapasitesi üzerinden'}
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, breakInside: 'avoid' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block' }}>
                      {isEn ? 'AVERAGE STUDY DURATION' : 'ORTALAMA ÇALIŞMA SÜRESİ'}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: 'secondary.main', mt: 0.5 }}>
                      {data.analytics?.avgDurationHours || '2.4'} {isEn ? 'Hours / Session' : 'Saat / Oturum'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isEn ? 'Based on max 3-hour daily session limit' : 'Maksimum 3 saatlik oturum kotası üzerinden'}
                    </Typography>
                  </Paper>
                </Box>

                {/* ODA YOĞUNLUĞU + BÖLÜM DAĞILIMI */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2.5,
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                    '@media print': { gridTemplateColumns: '1fr 1fr', gap: 1.5 },
                  }}
                >
                  <Box sx={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <RoomDensityChart />
                  </Box>

                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      breakInside: 'avoid',
                      pageBreakInside: 'avoid',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <SchoolIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {isEn ? 'Usage Breakdown by Department' : 'Bölüm Bazlı Kullanım Dağılımı'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      {isEn
                        ? 'Share of faculties and departments actively using study rooms (Activity Report Data).'
                        : 'Çalışma odalarını en aktif kullanan fakülte ve bölümlerin oranı (Faaliyet Raporu Verisi).'}
                    </Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                      {(data.analytics?.departmentBreakdown || []).map((dept) => {
                        const deptName = isEn ? DEPT_EN_MAP[dept.name] || dept.name : dept.name;
                        return (
                          <Box key={dept.name}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                                {deptName}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                %{dept.percentage} ({dept.count} {isEn ? 'Sessions' : 'Katılım'})
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={dept.percentage}
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                </Box>

                {/* ODA BAZLI TERCİH SIRALAMASI */}
                {data.analytics?.roomBreakdown?.length > 0 && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 2.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      breakInside: 'avoid',
                      pageBreakInside: 'avoid',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <MeetingRoomIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {isEn
                          ? 'Study Room Preference & Total Usage Ranking'
                          : 'Çalışma Odası Tercih & Toplam Kullanım Sıralaması'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                      {isEn
                        ? 'Comparison of total confirmed bookings and total study hours across the 4 study rooms.'
                        : '4 çalışma odasının toplam onaylanan randevu sayısı ve toplam çalışma saati karşılaştırması.'}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                      {data.analytics.roomBreakdown.map((rm) => (
                        <Paper key={rm.roomNumber} variant="outlined" sx={{ p: 1.75, borderRadius: 2, breakInside: 'avoid' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {rm.roomNumber} - {rm.name}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                              {rm.count} {isEn ? 'Bookings' : 'Randevu'} ({rm.hoursBooked} {isEn ? 'Hrs' : 'Saat'})
                            </Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={rm.percentage} sx={{ height: 7, borderRadius: 4 }} />
                        </Paper>
                      ))}
                    </Box>
                  </Paper>
                )}

                {/* 7/24 SAATLİK YOĞUNLUK ISI HARİTASI */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    breakInside: 'avoid',
                    pageBreakInside: 'avoid',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <WhatshotIcon color="warning" fontSize="small" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {isEn
                        ? '24/7 Hourly Occupancy Heatmap (Peak Hours)'
                        : '7/24 Saatlik Yoğunluk Isı Haritası (Peak Hours Heatmap)'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    {isEn
                      ? 'Shows which hourly slots between 00:00 – 24:00 are most preferred by student groups.'
                      : '00:00 – 24:00 arası hangi saat dilimlerinde çalışma odalarının daha çok tercih edildiğini gösterir.'}
                  </Typography>

                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(6, 1fr)', md: 'repeat(8, 1fr)' }, gap: 1 }}>
                    {(data.analytics?.hourlyHeatmap || []).map((slot) => {
                      const ratio = slot.count / maxHeatCount;
                      const bg =
                        slot.count === 0
                          ? alpha(theme.palette.text.disabled, 0.08)
                          : ratio > 0.7
                          ? alpha(theme.palette.error.main, 0.85)
                          : ratio > 0.35
                          ? alpha(theme.palette.warning.main, 0.75)
                          : alpha(theme.palette.primary.main, 0.55);
                      const textCol = slot.count === 0 ? 'text.secondary' : '#fff';

                      return (
                        <Tooltip key={slot.hour} title={`${slot.hour}: ${slot.count} ${isEn ? 'bookings' : 'rezervasyon'}`}>
                          <Box
                            sx={{
                              p: 1,
                              borderRadius: 1.5,
                              bgcolor: bg,
                              color: textCol,
                              textAlign: 'center',
                              '@media print': {
                                border: '1px solid #CBD5E1',
                                WebkitPrintColorAdjust: 'exact',
                                printColorAdjust: 'exact',
                              },
                            }}
                          >
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800 }}>{slot.hour}</Typography>
                            <Typography sx={{ fontSize: '0.68rem', opacity: 0.9 }}>
                              {slot.count} {isEn ? 'Groups' : 'Grup'}
                            </Typography>
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                </Paper>
              </Box>
            )}

            {/* ================= SEKME 1: REZERVASYON YÖNETİMİ (TELEFON NUMARASI DAHİL) ================= */}
            {tab === 1 && (
              <Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 2 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder={
                      isEn
                        ? 'Search reservations (Student name, email, phone, student ID, room, or purpose)...'
                        : 'Rezervasyonlarda ara (Öğrenci adı, e-posta, telefon no, öğrenci no, oda adı veya çalışma amacı)...'
                    }
                    value={resSearch}
                    onChange={(e) => { setResSearch(e.target.value); setResPage(1); }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Select
                    size="small"
                    value={resRoomFilter}
                    onChange={(e) => { setResRoomFilter(e.target.value); setResPage(1); }}
                    sx={{ minWidth: { xs: '100%', sm: 190 } }}
                  >
                    <MenuItem value="ALL">{isEn ? 'All Rooms (R101-R104)' : 'Tüm Odalar (R101-R104)'}</MenuItem>
                    {(data.rooms || []).map((rm) => (
                      <MenuItem key={rm.id} value={rm.roomNumber}>
                        {rm.roomNumber} - {rm.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label={isEn ? 'Active & Pending' : 'Devam Eden & Bekleyenler'}
                      color={resFilter === 'ACTIVE' ? 'primary' : 'default'}
                      onClick={() => { setResFilter('ACTIVE'); setResPage(1); }}
                      sx={{ fontWeight: 700, cursor: 'pointer' }}
                    />
                    <Chip
                      label={isEn ? 'Completed (History)' : 'Tamamlananlar (Geçmiş)'}
                      color={resFilter === 'COMPLETED' ? 'success' : 'default'}
                      onClick={() => { setResFilter('COMPLETED'); setResPage(1); }}
                      sx={{ fontWeight: 700, cursor: 'pointer' }}
                    />
                    <Chip
                      label={isEn ? 'Cancelled & No-Show' : 'İptal & No-Show (Uyarı Alanlar)'}
                      color={resFilter === 'CANCELLED' ? 'error' : 'default'}
                      onClick={() => { setResFilter('CANCELLED'); setResPage(1); }}
                      sx={{ fontWeight: 700, cursor: 'pointer' }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    {isEn ? `Found: ${filteredReservations.length} records` : `Bulunan: ${filteredReservations.length} kayıt`}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {paginatedReservations.length === 0 ? (
                    <Alert severity="info">
                      {isEn ? 'No reservations match your search criteria.' : 'Arama kriterlerinize uygun rezervasyon kaydı bulunamadı.'}
                    </Alert>
                  ) : (
                    paginatedReservations.map((r) => {
                      const hasActions = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status);
                      return (
                        <Paper
                          key={r.id}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.75, sm: 2.25 },
                            borderRadius: 2,
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                          }}
                        >
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
                                {r.room?.roomNumber} - {r.room?.name}
                              </Typography>
                              <Chip
                                label={r.status}
                                size="small"
                                color={
                                  r.status === 'CHECKED_IN' || r.status === 'CONFIRMED'
                                    ? 'success'
                                    : r.status === 'COMPLETED'
                                    ? 'info'
                                    : r.status === 'PENDING'
                                    ? 'warning'
                                    : 'error'
                                }
                                sx={{ fontWeight: 700, height: 22 }}
                              />
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                                {fmtDate(r.reservationDate)} | {fmtTime(r.startTime)} - {fmtTime(r.endTime)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                              {isEn ? 'Organizer:' : 'Organizatör:'} {r.user?.fullName} ({r.user?.email})
                              {r.user?.phone ? ` • 📞 ${r.user.phone}` : ''} • {r.user?.department || '-'}
                            </Typography>
                            {r.purpose && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontWeight: 600 }}>
                                {isEn ? 'Purpose:' : 'Çalışma Amacı:'} {r.purpose}
                              </Typography>
                            )}
                            {r.participants?.length > 0 && (
                              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                                {r.participants.map((p, idx) => (
                                  <Chip
                                    key={idx}
                                    size="small"
                                    variant="outlined"
                                    label={`${p.user?.fullName || p.user?.email}${p.user?.phone ? ` (📞 ${p.user.phone})` : ''} (${p.status})`}
                                    color={p.status === 'ACCEPTED' ? 'success' : p.status === 'REJECTED' ? 'error' : 'warning'}
                                    sx={{ height: 22, fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>

                          {hasActions && (
                            <>
                              <Divider />
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                {['PENDING', 'CONFIRMED'].includes(r.status) && (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={<CheckCircleOutlineIcon />}
                                    onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'FORCE_CHECKIN' }, 'Manuel Check-In yapıldı.')}
                                  >
                                    {isEn ? 'Manual Check-In' : 'Manuel Check-In'}
                                  </Button>
                                )}

                                {['CONFIRMED', 'CHECKED_IN'].includes(r.status) && (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="info"
                                    startIcon={<DoneAllIcon />}
                                    onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'EARLY_FINISH' }, 'Oda erken boşaltıldı ve kalan saatler boşa çıkarıldı.')}
                                  >
                                    {isEn ? 'Early Check-Out' : 'Erken Bitir (Boşalt)'}
                                  </Button>
                                )}

                                {['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status) && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'MARK_NO_SHOW' }, 'Kiosk onayı vermeyenlere No-Show uyarısı (1/3) işlendi.')}
                                  >
                                    {isEn ? 'Issue No-Show Warning' : 'No-Show Uyarısı Ver'}
                                  </Button>
                                )}

                                {['PENDING', 'CONFIRMED'].includes(r.status) && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'CANCEL' }, 'Rezervasyon iptal edildi ve bildirim mailleri gönderildi.')}
                                  >
                                    {isEn ? 'Cancel' : 'İptal Et'}
                                  </Button>
                                )}
                              </Box>
                            </>
                          )}
                        </Paper>
                      );
                    })
                  )}
                </Box>

                {filteredReservations.length > ITEMS_PER_PAGE && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                    <Pagination
                      count={Math.ceil(filteredReservations.length / ITEMS_PER_PAGE)}
                      page={resPage}
                      onChange={(_, p) => setResPage(p)}
                      color="primary"
                    />
                  </Box>
                )}
              </Box>
            )}

            {/* ================= SEKME 2: ODALARI EKLE / DÜZENLE / SİL ================= */}
            {tab === 2 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {isEn ? (
                    <>When you turn off a study room switch (Maintenance), <strong>existing confirmed bookings are NOT cancelled</strong>; only new reservations are paused.</>
                  ) : (
                    <>Bir çalışma odasını anahtardan kapattığınızda (Bakıma Aldığınızda), o odaya ait <strong>mevcut onaylı randevular iptal edilmez</strong>; yalnızca yeni randevu alımı durdurulur.</>
                  )}
                </Alert>

                {isAdminOrSuper && (
                  <Box sx={{ p: 2.5, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'stretch' }}>
                    <TextField
                      label={isEn ? 'Room Code (e.g. R105)' : 'Oda Kodu (Örn: R105)'}
                      size="small"
                      value={newRoom.roomNumber}
                      onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField
                      label={isEn ? 'Room Name (e.g. Vecihi)' : 'Oda Adı (Örn: Vecihi)'}
                      size="small"
                      fullWidth
                      value={newRoom.name}
                      onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField
                      label={isEn ? 'Capacity' : 'Kapasite'}
                      type="number"
                      size="small"
                      value={newRoom.capacity}
                      onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
                      sx={{ width: { xs: '100%', sm: 120 }, bgcolor: 'background.paper' }}
                    />
                    <Button
                      variant="contained"
                      startIcon={<AddCircleOutlineIcon />}
                      onClick={() => {
                        runAction('CREATE_ROOM', newRoom, 'Yeni çalışma odası eklendi.');
                        setNewRoom({ roomNumber: '', name: '', capacity: 8 });
                      }}
                      sx={{ whiteSpace: 'nowrap', py: 1 }}
                    >
                      {isEn ? 'Add Room' : 'Oda Ekle'}
                    </Button>
                  </Box>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  {(data.rooms || []).map((room) => (
                    <Card key={room.id} sx={{ p: 2.5, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, borderLeft: `4px solid ${room.isActive ? theme.palette.success.main : theme.palette.error.main}` }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                            {room.roomNumber} - {room.name}
                          </Typography>
                          <Chip
                            label={room.isActive ? (isEn ? 'ACTIVE (OPEN)' : 'AKTİF (AÇIK)') : (isEn ? 'PAUSED FOR NEW BOOKINGS' : 'YENİ RANDEVUYA KAPALI')}
                            size="small"
                            color={room.isActive ? 'success' : 'error'}
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {isEn ? 'Max Capacity:' : 'Maksimum Kapasite:'} <strong>{room.capacity} {isEn ? 'People' : 'Kişi'}</strong>
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={room.isActive ? 'Yeni Randevulara Kapat (Mevcutlar Korunur)' : 'Odayı Yeni Rezervasyona Aç'}>
                          <Switch
                            checked={room.isActive}
                            color="success"
                            onChange={(e) =>
                              runAction(
                                'TOGGLE_ROOM',
                                { roomId: room.id, isActive: e.target.checked },
                                `${room.roomNumber} ${e.target.checked ? 'yeni rezervasyonlara açıldı' : 'yeni rezervasyonlara kapatıldı (mevcut randevular korunuyor)'}.`
                              )
                            }
                          />
                        </Tooltip>

                        {isAdminOrSuper && (
                          <Tooltip title="Oda Adını ve Kapasitesini Düzenle">
                            <IconButton
                              color="primary"
                              size="small"
                              onClick={() =>
                                setEditRoomDialog({
                                  open: true,
                                  roomId: room.id,
                                  roomNumber: room.roomNumber,
                                  name: room.name,
                                  capacity: room.capacity,
                                })
                              }
                            >
                              <EditOutlinedIcon />
                            </IconButton>
                          </Tooltip>
                        )}

                        {isAdminOrSuper && (
                          <Tooltip title="Odayı Kalıcı Olarak Sil">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={() => {
                                if (window.confirm(`${room.roomNumber} - ${room.name} odasını silmek istediğinize emin misiniz?`)) {
                                  runAction('DELETE_ROOM', { roomId: room.id }, 'Oda sistemden silindi.');
                                }
                              }}
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {/* ================= SEKME 3: DUYURU YAYINLA ================= */}
            {tab === 3 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, gap: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    {isEn ? 'Publish New Announcement' : 'Yeni Duyuru Yayınla'}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField label="Türkçe Başlık" size="small" fullWidth value={annForm.titleTr} onChange={(e) => setAnnForm({ ...annForm, titleTr: e.target.value })} />
                    <TextField label="İngilizce Başlık (Opsiyonel)" size="small" fullWidth value={annForm.titleEn} onChange={(e) => setAnnForm({ ...annForm, titleEn: e.target.value })} />
                    <TextField label="Türkçe İçerik" size="small" multiline rows={3} fullWidth value={annForm.contentTr} onChange={(e) => setAnnForm({ ...annForm, contentTr: e.target.value })} />
                    <TextField label="İngilizce İçerik (Opsiyonel)" size="small" multiline rows={2} fullWidth value={annForm.contentEn} onChange={(e) => setAnnForm({ ...annForm, contentEn: e.target.value })} />
                    <Select size="small" value={annForm.priority} onChange={(e) => setAnnForm({ ...annForm, priority: e.target.value })}>
                      <MenuItem value="LOW">Düşük Öncelik (Bilgi)</MenuItem>
                      <MenuItem value="MEDIUM">Normal Duyuru</MenuItem>
                      <MenuItem value="HIGH">Önemli (Sabitlenmiş)</MenuItem>
                      <MenuItem value="URGENT">Acil Uyarı</MenuItem>
                    </Select>
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (!annForm.titleTr || !annForm.contentTr) return;
                        runAction('CREATE_ANNOUNCEMENT', annForm, 'Duyuru yayınlandı.');
                        setAnnForm({ titleTr: '', titleEn: '', contentTr: '', contentEn: '', priority: 'HIGH' });
                      }}
                    >
                      {isEn ? 'Publish Announcement' : 'Duyuruyu Yayınla'}
                    </Button>
                  </Box>
                </Box>

                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    {isEn ? `Active Announcements (${data.announcements?.length || 0})` : `Aktif Duyurular (${data.announcements?.length || 0})`}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(data.announcements || []).map((a) => (
                      <Paper key={a.id} variant="outlined" sx={{ p: 2, borderRadius: 2, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip label={a.priority} size="small" color={a.priority === 'HIGH' || a.priority === 'URGENT' ? 'error' : 'primary'} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                            <Typography sx={{ fontWeight: 700 }}>{isEn ? a.title?.en || a.title?.tr : a.title?.tr}</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {isEn ? a.content?.en || a.content?.tr : a.content?.tr}
                          </Typography>
                        </Box>
                        <IconButton color="error" size="small" onClick={() => runAction('DELETE_ANNOUNCEMENT', { id: a.id }, 'Duyuru silindi.')}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* ================= SEKME 4: ÖĞRENCİLER, TELEFON BİLGİSİ, BAN & YETKİLER ================= */}
            {tab === 4 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={isEn ? 'Search student name, email, phone, student ID, or department...' : 'Öğrenci adı, e-posta, telefon numarası, öğrenci no veya bölüm ara...'}
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setStudentPage(1); }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      {isEn ? `Student List & Ban Management (${studentList.length} Students)` : `Öğrenci Listesi ve Ban Yönetimi (${studentList.length} Öğrenci)`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {isEn ? 'Page' : 'Sayfa'} {studentPage} / {Math.max(1, Math.ceil(studentList.length / ITEMS_PER_PAGE))}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                    {paginatedStudents.map((u) => {
                      const noShowCount = u._count?.penalties || 0;
                      const banLabel = u.banUntil
                        ? `BANLI (${new Date(u.banUntil).toLocaleDateString('tr-TR')} tarihine kadar)`
                        : 'KALICI BANLI (PERMA BAN)';

                      return (
                        <Paper
                          key={u.id}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.75, sm: 2.25 },
                            borderRadius: 2,
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                          }}
                        >
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.98rem' }}>
                                {u.fullName || 'İsimsiz Öğrenci'}
                              </Typography>
                              {u.studentNumber && (
                                <Chip label={`#${u.studentNumber}`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
                              )}
                              <Chip
                                label={u.phone ? `📞 ${u.phone}` : (isEn ? '📞 No Phone' : '📞 Telefon Girilmedi')}
                                size="small"
                                variant="outlined"
                                color={u.phone ? 'info' : 'default'}
                                sx={{ height: 22, fontSize: '0.72rem', fontWeight: u.phone ? 700 : 400 }}
                              />
                              {u.department && (
                                <Chip label={u.department} size="small" sx={{ height: 22, fontSize: '0.72rem' }} />
                              )}
                              <Chip
                                label={`No-Show: ${noShowCount} / 3`}
                                size="small"
                                color={noShowCount >= 3 ? 'error' : noShowCount > 0 ? 'warning' : 'default'}
                                sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                              />
                              {u.isBanned && (
                                <Chip
                                  label={banLabel}
                                  size="small"
                                  color="error"
                                  sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontSize: '0.78rem', wordBreak: 'break-all' }}>
                              {u.email} {u.banReason ? `• Sebep: ${u.banReason}` : ''}
                            </Typography>
                          </Box>

                          <Divider />
                          {isAdminOrSuper ? (
                            <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
                              {(u.penaltyPoints > 0 || noShowCount > 0) && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<RestartAltIcon />}
                                  onClick={() => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'RESET_PENALTY' }, 'Öğrencinin uyarı sayacı sıfırlandı.')}
                                >
                                  {isEn ? 'Reset Warnings' : 'Uyarıları Sıfırla'}
                                </Button>
                              )}

                              {u.isBanned ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'UNBAN' }, 'Öğrencinin yasağı (ban) kaldırıldı.')}
                                >
                                  {isEn ? 'Unban Student' : 'Banı Aç (Yasağı Kaldır)'}
                                </Button>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                  startIcon={<BlockIcon />}
                                  onClick={() =>
                                    setBanDialog({
                                      open: true,
                                      userId: u.id,
                                      fullName: u.fullName || u.email,
                                      email: u.email,
                                      banMode: 'DATE',
                                      banUntilDateStr: getFutureDateStr(30),
                                      banReason: '',
                                    })
                                  }
                                >
                                  {isEn ? 'Ban (Select Date / Permanent)' : 'Banla (Tarih Seç / Kalıcı Ban)'}
                                </Button>
                              )}

                              <Select
                                size="small"
                                value={u.role}
                                onChange={(e) => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'CHANGE_ROLE', role: e.target.value }, 'Kullanıcı rolü güncellendi.')}
                                sx={{ minWidth: { xs: '100%', sm: 220 }, height: 32, fontSize: '0.8rem' }}
                              >
                                <MenuItem value="STUDENT">STUDENT (Öğrenci)</MenuItem>
                                <MenuItem value="LIBRARIAN">LIBRARIAN (Görevli Ata)</MenuItem>
                                {isSuperAdmin && <MenuItem value="ADMIN">ADMIN (Müdür Ata - Sadece BİM)</MenuItem>}
                                {isSuperAdmin && <MenuItem value="SUPER_ADMIN">SUPER_ADMIN (BİM Ata)</MenuItem>}
                              </Select>
                            </Box>
                          ) : (
                            <Box>
                              <Chip label="Sadece Görüntüleme (Görevli)" size="small" variant="outlined" />
                            </Box>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>

                  {studentList.length > ITEMS_PER_PAGE && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
                      <Pagination
                        count={Math.ceil(studentList.length / ITEMS_PER_PAGE)}
                        page={studentPage}
                        onChange={(_, p) => setStudentPage(p)}
                        color="primary"
                      />
                    </Box>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
                    {isEn ? `Library Staff & System Administrators (${staffList.length})` : `Kütüphane Görevlileri ve Sistem Yöneticileri (${staffList.length} Yetkili)`}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {staffList.map((u) => {
                      const canModifyThisStaff =
                        isSuperAdmin || (userRole === 'ADMIN' && u.role === 'LIBRARIAN');

                      return (
                        <Paper
                          key={u.id}
                          variant="outlined"
                          sx={{
                            p: { xs: 1.75, sm: 2.25 },
                            borderRadius: 2,
                            flexShrink: 0,
                            bgcolor: alpha(theme.palette.primary.main, 0.03),
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.5,
                          }}
                        >
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontWeight: 800 }}>{u.fullName}</Typography>
                              <Chip label={u.role} size="small" color="primary" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                              {u.phone && (
                                <Chip label={`📞 ${u.phone}`} size="small" variant="outlined" color="info" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }} />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}>
                              {u.email} • {u.department}
                            </Typography>
                          </Box>

                          <Divider />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            {canModifyThisStaff ? (
                              <Select
                                size="small"
                                value={u.role}
                                onChange={(e) => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'CHANGE_ROLE', role: e.target.value }, 'Yetkili rolü güncellendi.')}
                                sx={{ minWidth: { xs: '100%', sm: 220 }, height: 32, fontSize: '0.8rem', bgcolor: 'background.paper' }}
                              >
                                <MenuItem value="STUDENT">STUDENT (Öğrenciye Düşür)</MenuItem>
                                <MenuItem value="LIBRARIAN">LIBRARIAN (Görevli)</MenuItem>
                                {isSuperAdmin && <MenuItem value="ADMIN">ADMIN (Müdür)</MenuItem>}
                                {isSuperAdmin && <MenuItem value="SUPER_ADMIN">SUPER_ADMIN (BİM)</MenuItem>}
                              </Select>
                            ) : (
                              <Chip
                                label={isEn ? 'Only IT Admin (SUPER_ADMIN) can modify this role' : 'Bu yetkili seviyesini yalnızca BİM (SUPER_ADMIN) değiştirebilir'}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '0.72rem' }}
                              />
                            )}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Box>
              </Box>
            )}

            {/* ================= SEKME 5: DİNAMİK KURALLAR & EŞİT BOYDA 180 GÜN LOGLAR ================= */}
            {tab === 5 && isAdminOrSuper && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                    {isEn ? 'Library Reservation Rules (Dynamic Settings)' : 'Kütüphane Rezervasyon Kuralları (Dinamik Ayarlar)'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    {isEn
                      ? 'Changes made here immediately update both backend validation and student-facing rule notices.'
                      : 'Buradan değiştirdiğiniz kurallar hem arka plandaki kontrolleri hem de öğrenci ekranlarındaki uyarı metinlerini anında günceller.'}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    {(data.rules || []).map((rule) => {
                      const meta = RULE_META[rule.ruleName] || {
                        title: rule.ruleName,
                        titleEn: rule.ruleName,
                        desc: 'Sistem rezervasyon parametresi.',
                        descEn: 'System reservation parameter.',
                        unit: '',
                        unitEn: '',
                        min: 1,
                        max: 60,
                        step: 1,
                      };
                      const currentVal = rule.ruleValue?.value ?? 1;
                      const stepVal = meta.step || 1;

                      return (
                        <Paper key={rule.id} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 2 }}>
                          <Box>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', color: 'text.primary' }}>
                              {isEn ? meta.titleEn : meta.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                              {isEn ? meta.descEn : meta.desc}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap', gap: 1 }}>
                            <Chip
                              label={`${isEn ? 'Current:' : 'Mevcut Değer:'} ${currentVal} ${isEn ? meta.unitEn : meta.unit}`}
                              color="primary"
                              sx={{ fontWeight: 800 }}
                            />
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={currentVal <= meta.min}
                                onClick={() => runAction('UPDATE_RULE', { ruleName: rule.ruleName, value: Math.max(meta.min, currentVal - stepVal) }, `${meta.title} güncellendi.`)}
                              >
                                {isEn ? `Decrease (-${stepVal})` : `Azalt (-${stepVal})`}
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                disabled={currentVal >= meta.max}
                                onClick={() => runAction('UPDATE_RULE', { ruleName: rule.ruleName, value: Math.min(meta.max, currentVal + stepVal) }, `${meta.title} güncellendi.`)}
                              >
                                {isEn ? `Increase (+${stepVal})` : `Artır (+${stepVal})`}
                              </Button>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Box>

                <Divider />

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.primary.main, 0.2),
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Inventory2OutlinedIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {isEn ? 'Log Retention & Archiving Policy (180 Days Active / 1 Year Archive)' : 'Log Saklama ve Arşivleme Politikası (Müdürlük & BİM Denetimi)'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {isEn ? (
                          <>Showing activity logs for the <strong>last {data.logRetentionPolicy?.activeDisplayDays || 180} days (1 Semester)</strong>. Older logs are archived in the database for <strong>1 Year (365 Days)</strong>.</>
                        ) : (
                          <>Bu ekranda yalnızca <strong>son {data.logRetentionPolicy?.activeDisplayDays || 180} günün (1 Akademik Dönem)</strong> hareket kayıtları listelenmektedir. 180 günü aşan kayıtlar <strong>1 Yıl (365 Gün)</strong> boyunca veritabanı arşivinde saklanır.</>
                        )}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    label={isEn ? `1-Year Archive Records: ${data.logRetentionPolicy?.archivedRecordsCount || 0}` : `1 Yıllık Arşivdeki Kayıt: ${data.logRetentionPolicy?.archivedRecordsCount || 0}`}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Paper>

                {/* SOL VE SAĞ SÜTUNDAKİ LOG KARTLARI EŞİT BOYDA (minHeight: 118) HİZALANDI */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, alignItems: 'stretch' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {isEn ? '1. Student & System Logs (Last 180 Days)' : '1. Öğrenci & Sistem Logları (Son 180 Gün)'}
                        </Typography>
                        <Chip label={`${data.auditLogs?.length || 0}`} size="small" />
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {paginatedAuditLogs.map((log) => {
                          const formatted = formatAuditLog(log, isEn);
                          return (
                            <Paper
                              key={log.id}
                              variant="outlined"
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                minHeight: 118,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                                  <Chip label={formatted.badge} size="small" color={formatted.color} sx={{ fontWeight: 700, height: 22 }} />
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {new Date(log.createdAt).toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                  {formatted.title}
                                </Typography>
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-word', pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                                {formatted.detail}
                              </Typography>
                            </Paper>
                          );
                        })}
                      </Box>
                    </Box>

                    {(data.auditLogs?.length || 0) > ITEMS_PER_PAGE && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
                        <Pagination
                          size="small"
                          count={Math.ceil(data.auditLogs.length / ITEMS_PER_PAGE)}
                          page={auditPage}
                          onChange={(_, p) => setAuditPage(p)}
                          color="primary"
                        />
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                          {isEn ? '2. Admin Intervention Logs (Last 180 Days)' : '2. Yönetici Müdahale Logları (Son 180 Gün)'}
                        </Typography>
                        <Chip label={`${data.adminActions?.length || 0}`} size="small" />
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {paginatedAdminLogs.map((act) => (
                          <Paper
                            key={act.id}
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 2,
                              minHeight: 118,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                                <Chip label={act.actionType} size="small" color="secondary" sx={{ fontWeight: 700, height: 22 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  {new Date(act.createdAt).toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                {act.description}
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                              {isEn ? 'Performed By:' : 'İşlemi Yapan Yetkili:'} {act.admin?.fullName} ({act.admin?.email})
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    </Box>

                    {(data.adminActions?.length || 0) > ITEMS_PER_PAGE && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
                        <Pagination
                          size="small"
                          count={Math.ceil(data.adminActions.length / ITEMS_PER_PAGE)}
                          page={adminLogPage}
                          onChange={(_, p) => setAdminLogPage(p)}
                          color="secondary"
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      </Container>

      <Box sx={{ '@media print': { display: 'none' } }}>
        <Footer />
      </Box>

      {/* Çalışma Odası Bilgilerini Düzenleme Modalı */}
      <Dialog
        open={editRoomDialog.open}
        onClose={() => setEditRoomDialog({ ...editRoomDialog, open: false })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Çalışma Odası Bilgilerini Düzenle</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField
            label="Oda Kodu"
            size="small"
            fullWidth
            value={editRoomDialog.roomNumber}
            onChange={(e) => setEditRoomDialog({ ...editRoomDialog, roomNumber: e.target.value })}
          />
          <TextField
            label="Oda İsmi"
            size="small"
            fullWidth
            value={editRoomDialog.name}
            onChange={(e) => setEditRoomDialog({ ...editRoomDialog, name: e.target.value })}
          />
          <TextField
            label="Maksimum Kapasite (Kişi)"
            type="number"
            size="small"
            fullWidth
            value={editRoomDialog.capacity}
            onChange={(e) => setEditRoomDialog({ ...editRoomDialog, capacity: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditRoomDialog({ ...editRoomDialog, open: false })} color="inherit">
            Vazgeç
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              runAction(
                'UPDATE_ROOM',
                {
                  roomId: editRoomDialog.roomId,
                  roomNumber: editRoomDialog.roomNumber,
                  name: editRoomDialog.name,
                  capacity: editRoomDialog.capacity,
                },
                'Oda bilgileri başarıyla güncellendi.'
              );
              setEditRoomDialog({ ...editRoomDialog, open: false });
            }}
          >
            Değişiklikleri Kaydet
          </Button>
        </DialogActions>
      </Dialog>

      {/* Takvimden Tarih Seçmeli veya Kalıcı (Perma) Banlama Modalı */}
      <Dialog
        open={banDialog.open}
        onClose={() => setBanDialog({ ...banDialog, open: false })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>
          Öğrenciyi Yasakla (Takvimli / Kalıcı Ban)
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{banDialog.fullName}</strong> ({banDialog.email}) öğrencisi için ban türünü seçiniz:
          </Typography>

          <Select
            size="small"
            fullWidth
            value={banDialog.banMode}
            onChange={(e) => setBanDialog({ ...banDialog, banMode: e.target.value })}
          >
            <MenuItem value="DATE">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon fontSize="small" color="primary" />
                <span>Belirli Bir Tarihe Kadar Banla (Takvimden Seç)</span>
              </Box>
            </MenuItem>
            <MenuItem value="PERMANENT">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AllInclusiveIcon fontSize="small" color="error" />
                <span>Kalıcı Banla (Perma Ban - Süresiz)</span>
              </Box>
            </MenuItem>
          </Select>

          {banDialog.banMode === 'DATE' && (
            <Box>
              <TextField
                label="Ban Bitiş Tarihi (Takvimden Gün Seçiniz)"
                type="date"
                size="small"
                fullWidth
                value={banDialog.banUntilDateStr}
                onChange={(e) => setBanDialog({ ...banDialog, banUntilDateStr: e.target.value })}
                inputProps={{ min: minTomorrowDateStr }}
                InputLabelProps={{ shrink: true }}
              />
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                {[
                  { label: '+7 Gün', days: 7 },
                  { label: '+14 Gün', days: 14 },
                  { label: '+30 Gün', days: 30 },
                  { label: '+90 Gün', days: 90 },
                ].map((preset) => (
                  <Chip
                    key={preset.days}
                    label={preset.label}
                    size="small"
                    variant="outlined"
                    onClick={() => setBanDialog({ ...banDialog, banUntilDateStr: getFutureDateStr(preset.days) })}
                    sx={{ cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {banDialog.banMode === 'PERMANENT' && (
            <Alert severity="error" sx={{ py: 0.5, fontSize: '0.78rem' }}>
              Kalıcı (Perma) ban seçildiğinde öğrencinin rezervasyon yetkisi yönetici tarafından manuel açılana kadar süresiz kapatılır.
            </Alert>
          )}

          <TextField
            label="Ban Sebebi (Öğrenciye e-posta ile iletilir)"
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Örn: Çalışma odası kurallarının ihlali / 3 kez No-Show"
            value={banDialog.banReason}
            onChange={(e) => setBanDialog({ ...banDialog, banReason: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBanDialog({ ...banDialog, open: false })} color="inherit">
            Vazgeç
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              runAction(
                'USER_MODERATION',
                {
                  targetUserId: banDialog.userId,
                  modType: 'BAN_USER',
                  banMode: banDialog.banMode,
                  banUntilDateStr: banDialog.banUntilDateStr,
                  banReason: banDialog.banReason,
                },
                banDialog.banMode === 'PERMANENT'
                  ? 'Öğrenci kalıcı olarak (Perma Ban) yasaklandı.'
                  : `Öğrenci ${banDialog.banUntilDateStr} tarihine kadar banlandı.`
              );
              setBanDialog({ ...banDialog, open: false });
            }}
          >
            Yasağı Uygula
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}