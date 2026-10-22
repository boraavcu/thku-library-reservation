import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Grid, Tabs, Tab, Button, Chip,
  Switch, TextField, Select, MenuItem, IconButton, CircularProgress,
  Alert, Snackbar, Divider, Paper, Tooltip, InputAdornment, Pagination,
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import RoomDensityChart from '../components/RoomDensityChart';
import UsageChart from '../components/UsageChart';
import api from '../api';
import thkuLogo from '../assets/thku-logo.png';

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

const STAFF_ROLES = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'];
const ITEMS_PER_PAGE = 10;

const RULE_META = {
  MIN_PARTICIPANTS: {
    title: 'Minimum Katılımcı Sayısı (Kişi)',
    desc: 'Bir çalışma odasının rezerve edilebilmesi için gereken en az öğrenci sayısı (Varsayılan: 2).',
    unit: 'Kişi',
    min: 1,
    max: 8,
  },
  MAX_PARTICIPANTS: {
    title: 'Maksimum Oda Kapasitesi (Kişi)',
    desc: 'Bir çalışma odasına aynı anda girebilecek en fazla öğrenci sayısı (Madde 2: 8 Kişi).',
    unit: 'Kişi',
    min: 2,
    max: 16,
  },
  MAX_DURATION_HOURS: {
    title: 'Günlük Maksimum Rezervasyon Süresi (Saat)',
    desc: 'Bir grubun günde tek seferde alabileceği en uzun çalışma süresi (Madde 9: Maks 3 Saat, Uzatma Yok).',
    unit: 'Saat',
    min: 1,
    max: 6,
  },
  MAX_ADVANCE_DAYS: {
    title: 'İleri Tarihli Rezervasyon Sınırı (Gün)',
    desc: 'Öğrencilerin kaç gün sonrasına kadar rezervasyon yapabileceği (Madde 3: Varsayılan 1 Gün).',
    unit: 'Gün',
    min: 1,
    max: 14,
  },
  DAILY_RELEASE_HOUR: {
    title: 'Yeni Gün Kotalarının Açılış Saati',
    desc: 'İleri tarihli yeni gün rezervasyonlarının sabah saat kaçta açılacağı.',
    unit: ':00',
    min: 0,
    max: 23,
  },
};

function formatAuditLogTurkish(log) {
  const actor = log.user?.fullName || log.user?.email || 'Sistem / Öğrenci';
  const d = log.newData || {};
  const old = log.oldData || {};

  switch (log.action) {
    case 'RESERVATION_CREATED':
      return {
        badge: 'Yeni Rezervasyon',
        color: 'primary',
        title: `${actor} yeni bir grup çalışma odası rezervasyonu oluşturdu.`,
        detail: `Oda: ${d.room || '-'} | Tarih: ${d.date || '-'} | Saat: ${d.time || '-'} | Davet Edilenler: ${(d.invitedParticipants || []).join(', ') || 'Yok'}`,
      };
    case 'RESERVATION_CHECKED_IN':
      return {
        badge: 'Kişisel Kiosk Girişi',
        color: 'success',
        title: `${actor} kapı QR kodundan kişisel doğrulama kodunu girerek yoklamasını tamamladı.`,
        detail: `Oda: ${d.room || '-'} | Doğrulayan: ${d.checkedInBy || actor} | Grup İlerlemesi: ${d.progress || '-'}`,
      };
    case 'RESERVATION_CANCELLED':
      return {
        badge: 'İptal Edildi',
        color: 'error',
        title: `${actor} rezervasyonu iptal etti.`,
        detail: `Oda: ${old.room || '-'} | Sebep: ${d.reason || 'Kullanıcı iptali'}`,
      };
    case 'RESERVATION_EARLY_CHECKOUT':
      return {
        badge: 'Erken Boşaltma',
        color: 'info',
        title: `${actor} çalışmasını erken tamamlayarak odayı diğer öğrencilere açtı.`,
        detail: `Oda: ${d.room || '-'} | İşlemi Yapan: ${d.releasedBy || actor}`,
      };
    case 'PARTICIPANT_ADDED':
      return {
        badge: 'Sonradan Üye Eklendi',
        color: 'primary',
        title: `${actor} onaylı/bekleyen randevusuna yeni bir grup üyesi davet etti.`,
        detail: `Oda: ${d.room || '-'} | Eklenen Öğrenci: ${d.addedEmail || '-'}`,
      };
    case 'PARTICIPANT_LEFT':
      return {
        badge: 'Gruptan Ayrıldı',
        color: 'warning',
        title: `${actor} çalışma grubundan ayrıldı.`,
        detail: `Oda: ${d.room || '-'} | Odada Kalan Onaylı Kişi: ${d.remainingCount || '-'}`,
      };
    case 'INVITATION_ACCEPTED':
      return {
        badge: 'Davet Kabulü',
        color: 'success',
        title: `${actor} kendisine gelen grup çalışma davetini kabul etti.`,
        detail: `Oda: ${d.room || '-'} | Katılımcı: ${d.participantEmail || actor}`,
      };
    case 'INVITATION_REJECTED':
      return {
        badge: 'Davet Reddi',
        color: 'warning',
        title: `${actor} grup çalışma davetini reddetti.`,
        detail: `Oda: ${d.room || '-'} | Katılımcı: ${d.participantEmail || actor}`,
      };
    default:
      return {
        badge: log.action,
        color: 'default',
        title: `${actor} sistem üzerinde bir işlem gerçekleştirdi.`,
        detail: `Hedef: ${log.entityType || '-'}`,
      };
  }
}

export default function AdminPanel() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: session, status } = useSession();

  const [tab, setTab] = useState(0);
  const [resFilter, setResFilter] = useState('ACTIVE');
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

  // Madde 7: Oda Düzenleme Modal State
  const [editRoomDialog, setEditRoomDialog] = useState({
    open: false,
    roomId: null,
    roomNumber: '',
    name: '',
    capacity: 8,
  });

  // Madde 6: Dönemsel / Süreli Banlama Modal State
  const [banDialog, setBanDialog] = useState({
    open: false,
    userId: null,
    fullName: '',
    email: '',
    banDuration: '30',
    banReason: '',
  });

  const userRole = session?.user?.role;
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

  // Madde 12: Faaliyet Raporu PDF Çıktısı Alma
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
    new Date(dStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const filteredReservations = useMemo(() => {
    return data.reservations.filter((r) => {
      if (resFilter === 'ACTIVE') return ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status);
      if (resFilter === 'COMPLETED') return r.status === 'COMPLETED';
      if (resFilter === 'CANCELLED') return ['CANCELLED', 'NO_SHOW'].includes(r.status);
      return true;
    });
  }, [data.reservations, resFilter]);

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
      (u.studentNumber || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q);

    return {
      studentList: data.users.filter((u) => u.role === 'STUDENT' && matches(u)),
      staffList: data.users.filter((u) => u.role !== 'STUDENT' && matches(u)),
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

  const activeBookingsCount = data.reservations.filter((r) => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status)).length;
  const bannedUsersCount = data.users.filter((u) => u.isBanned).length;
  const maxHeatCount = Math.max(1, ...(data.analytics?.hourlyHeatmap?.map((h) => h.count) || [1]));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ '@media print': { display: 'none' } }}>
        <Navbar />
      </Box>

      <Container maxWidth="lg" sx={{ pt: 3.5, pb: 6, flex: 1 }}>
        {/* Sadece PDF Çıktısında Görünecek Resmi Antet (Madde 12) */}
        <Box
          sx={{
            display: 'none',
            '@media print': {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pb: 2,
              mb: 3,
              borderBottom: '2px solid #0F172A',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box component="img" src={thkuLogo} alt="THKÜ" sx={{ width: 56, height: 56, objectFit: 'contain' }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A' }}>
                TÜRK HAVA KURUMU ÜNİVERSİTESİ
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                Kütüphane ve Dokümantasyon Daire Başkanlığı • Grup Çalışma Odaları Faaliyet & Yoğunluk Raporu
              </Typography>
            </Box>
          </Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
            Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}
          </Typography>
        </Box>

        {/* Üst Başlık ve Hızlı Kiosk Butonu */}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  Kütüphane Yönetim & Analiz Merkezi
                </Typography>
                <Chip label={userRole} color="primary" size="small" sx={{ fontWeight: 700 }} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Oda düzenleme, kapı QR posteri, PDF faaliyet raporu, dönemsel ban ve sistem denetim paneli
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {/* MADDE 12: PDF Faaliyet Raporu Çıktısı Butonu */}
            <Button
              variant="outlined"
              color="primary"
              startIcon={<PictureAsPdfIcon />}
              onClick={handlePrintPdfReport}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Faaliyet Raporu (PDF İndir)
            </Button>

            <Button
              variant="contained"
              color="secondary"
              startIcon={<QrCodeScannerIcon />}
              onClick={() => navigate('/kiosk')}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Kapı QR Posterini Aç (/kiosk)
            </Button>
          </Box>
        </Box>

        {/* Özet KPI Kartları */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ p: 2.25, borderLeft: `4px solid ${theme.palette.success.main}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>AKTİF ÇALIŞMA ODASI</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
                {data.rooms.filter((r) => r.isActive).length} / {data.rooms.length}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ p: 2.25, borderLeft: `4px solid ${theme.palette.primary.main}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>AKTİF / BEKLEYEN RANDEVU</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>{activeBookingsCount}</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ p: 2.25, borderLeft: `4px solid ${theme.palette.warning.main}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>ZİRVE YOĞUNLUK SAATİ</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: 'warning.main' }}>
                {data.analytics?.peakHour || '14:00'}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <Card sx={{ p: 2.25, borderLeft: `4px solid ${theme.palette.error.main}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>YASAKLI (BANLI) ÖĞRENCİ</Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: 'error.main' }}>{bannedUsersCount}</Typography>
            </Card>
          </Grid>
        </Grid>

        {/* Ana Yönetim Sekmeleri */}
        <Card>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              px: 2,
              '@media print': { display: 'none' },
            }}
          >
            <Tab icon={<BarChartIcon />} iconPosition="start" label="Yoğunluk & Doluluk Analizi" />
            <Tab icon={<EventAvailableIcon />} iconPosition="start" label="Rezervasyon Yönetimi" />
            <Tab icon={<MeetingRoomIcon />} iconPosition="start" label="Odaları Ekle / Düzenle / Sil" />
            <Tab icon={<CampaignIcon />} iconPosition="start" label="Duyuru Yayınla" />
            <Tab icon={<PeopleAltIcon />} iconPosition="start" label="Öğrenciler, Süreli Ban & Yetkiler" />
            {isAdminOrSuper && <Tab icon={<GavelIcon />} iconPosition="start" label="Kurallar & Loglar (180 Gün)" />}
          </Tabs>

          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* ================= SEKME 0: YOĞUNLUK & DOLULUK ANALİZİ (MADDE 12 PDF RAPORU) ================= */}
            {tab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.5,
                    borderRadius: 2.5,
                    bgcolor: alpha(theme.palette.info.main, 0.06),
                    border: '1px solid',
                    borderColor: alpha(theme.palette.info.main, 0.2),
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <RadarIcon color="info" fontSize="large" />
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        Gelecek 1 Saat Operasyon Radarı (Canlı Banko & Kapı QR Takibi)
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Şu an odalarda aktif <strong>{data.analytics?.activeNowRooms || 0} grup</strong> bulunuyor. Önümüzdeki 60 dakika içinde <strong>{data.analytics?.upcomingHourReservations || 0} yeni grup ({data.analytics?.upcomingHourStudents || 0} öğrenci)</strong> kapı QR doğrulaması yapacak.
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
                    Bu Sayfayı PDF Olarak Kaydet
                  </Button>
                </Paper>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <RoomDensityChart />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <UsageChart />
                  </Grid>
                </Grid>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <WhatshotIcon color="warning" fontSize="small" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          7/24 Saatlik Yoğunluk Isı Haritası (Peak Hours Heatmap)
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        00:00 – 24:00 arası hangi saat dilimlerinde çalışma odalarının daha çok tercih edildiğini gösterir.
                      </Typography>

                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1 }}>
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
                            <Tooltip key={slot.hour} title={`${slot.hour} diliminde toplam ${slot.count} rezervasyon`}>
                              <Box
                                sx={{
                                  p: 1,
                                  borderRadius: 1.5,
                                  bgcolor: bg,
                                  color: textCol,
                                  textAlign: 'center',
                                }}
                              >
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800 }}>{slot.hour}</Typography>
                                <Typography sx={{ fontSize: '0.65rem', opacity: 0.9 }}>{slot.count} Grup</Typography>
                              </Box>
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, md: 5 }}>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid', borderColor: 'divider', height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <SchoolIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          Bölüm Bazlı Kullanım Dağılımı
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Çalışma odalarını en aktif kullanan fakülte ve bölümlerin oranı (Faaliyet Raporu Verisi).
                      </Typography>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                        {(data.analytics?.departmentBreakdown || []).map((dept) => (
                          <Box key={dept.name}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                                {dept.name}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                %{dept.percentage} ({dept.count} Katılım)
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={dept.percentage}
                              sx={{ height: 7, borderRadius: 4 }}
                            />
                          </Box>
                        ))}
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            )}

            {/* ================= SEKME 1: REZERVASYONLAR (UZATMA YOK - MADDE 9) ================= */}
            {tab === 1 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip
                      label="Devam Eden & Bekleyenler"
                      color={resFilter === 'ACTIVE' ? 'primary' : 'default'}
                      onClick={() => { setResFilter('ACTIVE'); setResPage(1); }}
                       sx={{ fontWeight: 700, cursor: 'pointer' }}
                    />
                    <Chip
                      label="Tamamlananlar (Geçmiş)"
                      color={resFilter === 'COMPLETED' ? 'success' : 'default'}
                      onClick={() => { setResFilter('COMPLETED'); setResPage(1); }}
                      sx={{ fontWeight: 700, cursor: 'pointer' }}
                    />
                    <Chip
                      label="İptal & No-Show (Uyarı Alanlar)"
                      color={resFilter === 'CANCELLED' ? 'error' : 'default'}
                      onClick={() => { setResFilter('CANCELLED'); setResPage(1); }}
                      sx={{ fontWeight: 700, cursor: 'pointer' }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Toplam {filteredReservations.length} kayıt (Sayfa başına 10 kayıt)
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {paginatedReservations.length === 0 ? (
                    <Alert severity="info">Bu kategoride rezervasyon kaydı bulunmuyor.</Alert>
                  ) : (
                    paginatedReservations.map((r) => (
                      <Paper key={r.id} variant="outlined" sx={{ p: 2.25, borderRadius: 2, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontWeight: 800 }}>
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
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Organizatör: {r.user?.fullName} ({r.user?.email}) • {r.user?.department || 'Bölüm Belirtilmedi'}
                          </Typography>
                          {r.participants?.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                              {r.participants.map((p, idx) => (
                                <Chip
                                  key={idx}
                                  size="small"
                                  variant="outlined"
                                  label={`${p.user?.fullName || p.user?.email} (${p.status})`}
                                  color={p.status === 'ACCEPTED' ? 'success' : p.status === 'REJECTED' ? 'error' : 'warning'}
                                  sx={{ height: 20, fontSize: '0.68rem' }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {['PENDING', 'CONFIRMED'].includes(r.status) && (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircleOutlineIcon />}
                              onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'FORCE_CHECKIN' }, 'Manuel Check-In yapıldı ve görevli maili gönderildi.')}
                            >
                              Manuel Check-In
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
                              Erken Bitir (Boşalt)
                            </Button>
                          )}

                          {['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status) && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'MARK_NO_SHOW' }, 'Kiosk kodu girmeyenlere No-Show uyarısı (1/3) ve e-postası gönderildi.')}
                            >
                              No-Show Uyarısı Ver (Mail Gönder)
                            </Button>
                          )}

                          {['PENDING', 'CONFIRMED'].includes(r.status) && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'CANCEL' }, 'Rezervasyon iptal edildi ve oda boşa çıkarıldı.')}
                            >
                              İptal Et
                            </Button>
                          )}
                        </Box>
                      </Paper>
                    ))
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

            {/* ================= SEKME 2: ODALARI EKLE / DÜZENLE / SİL (MADDE 2 & MADDE 7) ================= */}
            {tab === 2 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {isAdminOrSuper && (
                  <Box sx={{ p: 2.5, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'center' }}>
                    <TextField
                      label="Oda Kodu (Örn: R105)"
                      size="small"
                      value={newRoom.roomNumber}
                      onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField
                      label="Oda Adı (Örn: Hezarfen)"
                      size="small"
                      fullWidth
                      value={newRoom.name}
                      onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField
                      label="Kapasite"
                      type="number"
                      size="small"
                      value={newRoom.capacity}
                      onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
                      sx={{ width: 120, bgcolor: 'background.paper' }}
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
                      Oda Ekle
                    </Button>
                  </Box>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  {data.rooms.map((room) => (
                    <Card key={room.id} sx={{ p: 2.5, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${room.isActive ? theme.palette.success.main : theme.palette.error.main}` }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                            {room.roomNumber} - {room.name}
                          </Typography>
                          <Chip
                            label={room.isActive ? 'AKTİF (AÇIK)' : 'BAKIMDA (KAPALI)'}
                            size="small"
                            color={room.isActive ? 'success' : 'error'}
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Maksimum Kapasite: <strong>{room.capacity} Kişi</strong> (En Az 2 Kişi)
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={room.isActive ? 'Odayı Bakıma Al (Kapat)' : 'Odayı Rezervasyona Aç'}>
                          <Switch
                            checked={room.isActive}
                            color="success"
                            onChange={(e) =>
                              runAction(
                                'TOGGLE_ROOM',
                                { roomId: room.id, isActive: e.target.checked },
                                `${room.roomNumber} ${e.target.checked ? 'rezervasyona açıldı' : 'bakıma alındı'}.`
                              )
                            }
                          />
                        </Tooltip>

                        {/* MADDE 7: Odayı Oluşturduktan Sonra Bile İsim, Kod ve Kapasitesini Düzenleme */}
                        {isAdminOrSuper && (
                          <Tooltip title="Oda Adını ve Kapasitesini Düzenle (Madde 7)">
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
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Yeni Duyuru Yayınla</Typography>
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
                      Duyuruyu Yayınla
                    </Button>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Aktif Duyurular</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {data.announcements.map((a) => (
                      <Paper key={a.id} variant="outlined" sx={{ p: 2, borderRadius: 2, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={a.priority} size="small" color={a.priority === 'HIGH' || a.priority === 'URGENT' ? 'error' : 'primary'} sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                            <Typography sx={{ fontWeight: 700 }}>{a.title?.tr}</Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{a.content?.tr}</Typography>
                        </Box>
                        <IconButton color="error" size="small" onClick={() => runAction('DELETE_ANNOUNCEMENT', { id: a.id }, 'Duyuru silindi.')}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Paper>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            )}

            {/* ================= SEKME 4: ÖĞRENCİ ARAMA, DÖNEMSEL BAN & YETKİLİLER (MADDE 6) ================= */}
            {tab === 4 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Öğrenci adı, kurumsal e-posta (@stu.thk.edu.tr), öğrenci numarası veya bölüm ara..."
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Öğrenci Listesi ve Ban Yönetimi ({studentList.length} Öğrenci)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Sayfa {studentPage} / {Math.max(1, Math.ceil(studentList.length / ITEMS_PER_PAGE))}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {paginatedStudents.map((u) => {
                      const noShowCount = u._count?.penalties || 0;
                      const banUntilFormatted = u.banUntil
                        ? new Date(u.banUntil).toLocaleDateString('tr-TR')
                        : 'Dönem Sonu';

                      return (
                        <Paper key={u.id} variant="outlined" sx={{ p: 2, borderRadius: 2, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontWeight: 700 }}>{u.fullName || 'İsimsiz Öğrenci'}</Typography>
                              {u.studentNumber && <Chip label={`#${u.studentNumber}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                              {u.department && <Chip label={u.department} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
                              <Chip
                                label={`No-Show Uyarısı: ${noShowCount} / 3`}
                                size="small"
                                color={noShowCount >= 3 ? 'error' : noShowCount > 0 ? 'warning' : 'default'}
                                sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                              />
                              {u.isBanned && (
                                <Chip
                                  label={`BANLI (${banUntilFormatted}'e kadar)`}
                                  size="small"
                                  color="error"
                                  sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {u.email} {u.banReason ? `• Sebep: ${u.banReason}` : ''}
                            </Typography>
                          </Box>

                          {isAdminOrSuper ? (
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                              {(u.penaltyPoints > 0 || noShowCount > 0) && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<RestartAltIcon />}
                                  onClick={() => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'RESET_PENALTY' }, 'Öğrencinin uyarı sayacı sıfırlandı.')}
                                >
                                  Uyarıları Sıfırla
                                </Button>
                              )}

                              {u.isBanned ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  onClick={() => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'UNBAN' }, 'Öğrencinin yasağı (ban) kaldırıldı.')}
                                >
                                  Banı Aç (Yasağı Kaldır)
                                </Button>
                              ) : (
                                /* MADDE 6: Dönemsel veya Gün Seçmeli Banlama Butonu */
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
                                      banDuration: '30',
                                      banReason: '',
                                    })
                                  }
                                >
                                  Banla (Süre / Dönem Seç)
                                </Button>
                              )}

                              <Select
                                size="small"
                                value={u.role}
                                onChange={(e) => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'CHANGE_ROLE', role: e.target.value }, 'Rol güncellendi.')}
                                sx={{ minWidth: 140, height: 32, fontSize: '0.8rem' }}
                              >
                                <MenuItem value="STUDENT">STUDENT (Öğrenci)</MenuItem>
                                <MenuItem value="LIBRARIAN">LIBRARIAN (Görevli)</MenuItem>
                                <MenuItem value="ADMIN">ADMIN (Müdür)</MenuItem>
                                {isSuperAdmin && <MenuItem value="SUPER_ADMIN">SUPER_ADMIN (BİM)</MenuItem>}
                              </Select>
                            </Box>
                          ) : (
                            <Chip label="Sadece Görüntüleme (Görevli)" size="small" variant="outlined" />
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
                    Kütüphane Görevlileri ve Sistem Yöneticileri ({staffList.length} Yetkili)
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {staffList.map((u) => (
                      <Paper key={u.id} variant="outlined" sx={{ p: 2, borderRadius: 2, flexShrink: 0, bgcolor: alpha(theme.palette.primary.main, 0.03), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: 800 }}>{u.fullName}</Typography>
                            <Chip label={u.role} size="small" color="primary" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }} />
                          </Box>
                          <Typography variant="caption" color="text.secondary">{u.email} • {u.department}</Typography>
                        </Box>
                        {isSuperAdmin && (
                          <Select
                            size="small"
                            value={u.role}
                            onChange={(e) => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'CHANGE_ROLE', role: e.target.value }, 'Yetkili rolü güncellendi.')}
                            sx={{ minWidth: 150, height: 32, fontSize: '0.8rem' }}
                          >
                            <MenuItem value="STUDENT">STUDENT (Öğrenci)</MenuItem>
                            <MenuItem value="LIBRARIAN">LIBRARIAN (Görevli)</MenuItem>
                            <MenuItem value="ADMIN">ADMIN (Müdür)</MenuItem>
                            <MenuItem value="SUPER_ADMIN">SUPER_ADMIN (BİM)</MenuItem>
                          </Select>
                        )}
                      </Paper>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            {/* ================= SEKME 5: DİNAMİK KURALLAR & 180 GÜN LOGLAR (MADDE 3 & MADDE 11) ================= */}
            {tab === 5 && isAdminOrSuper && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
                    Kütüphane Rezervasyon Kuralları (Dinamik Ayarlar)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                    İleri tarih sınırı (varsayılan 1 gün), oda kapasitesi (8 kişi) ve süre kurallarını buradan anlık değiştirebilirsiniz.
                  </Typography>
                  <Grid container spacing={2}>
                    {data.rules.map((rule) => {
                      const meta = RULE_META[rule.ruleName] || {
                        title: rule.ruleName,
                        desc: 'Sistem rezervasyon parametresi.',
                        unit: '',
                        min: 1,
                        max: 30,
                      };
                      const currentVal = rule.ruleValue?.value ?? 1;

                      return (
                        <Grid size={{ xs: 12, sm: 6 }} key={rule.id}>
                          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 2 }}>
                            <Box>
                              <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', color: 'text.primary' }}>
                                {meta.title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                                {meta.desc}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                              <Chip
                                label={`Mevcut Değer: ${currentVal} ${meta.unit}`}
                                color="primary"
                                sx={{ fontWeight: 800 }}
                              />
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={currentVal <= meta.min}
                                  onClick={() => runAction('UPDATE_RULE', { ruleName: rule.ruleName, value: Math.max(meta.min, currentVal - 1) }, `${meta.title} güncellendi.`)}
                                >
                                  Azalt (-1)
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={currentVal >= meta.max}
                                  onClick={() => runAction('UPDATE_RULE', { ruleName: rule.ruleName, value: Math.min(meta.max, currentVal + 1) }, `${meta.title} güncellendi.`)}
                                >
                                  Artır (+1)
                                </Button>
                              </Box>
                            </Box>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>

                {isSuperAdmin && (
                  <>
                    <Divider />

                    {/* MADDE 11: 180 Gün Gösterim / 1 Yıl Arşiv Politikası Bilgi Kartı */}
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
                            Log Saklama ve Arşivleme Politikası (Madde 11)
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Bu ekranda yalnızca <strong>son {data.logRetentionPolicy?.activeDisplayDays || 180} günün (1 Akademik Dönem)</strong> hareket kayıtları listelenmektedir. 180 günü aşan kayıtlar <strong>1 Yıl (365 Gün)</strong> boyunca veritabanı arşivinde saklanır.
                          </Typography>
                        </Box>
                      </Box>
                      <Chip
                        label={`1 Yıllık Arşivdeki Kayıt: ${data.logRetentionPolicy?.archivedRecordsCount || 0}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                        sx={{ fontWeight: 700 }}
                      />
                    </Paper>

                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            1. Öğrenci & Sistem Logları (Son 180 Gün)
                          </Typography>
                          <Chip label={`${data.auditLogs?.length || 0} Kayıt`} size="small" />
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {paginatedAuditLogs.map((log) => {
                            const formatted = formatAuditLogTurkish(log);
                            return (
                              <Paper key={log.id} variant="outlined" sx={{ p: 2, borderRadius: 2, flexShrink: 0 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                                  <Chip label={formatted.badge} size="small" color={formatted.color} sx={{ fontWeight: 700, height: 22 }} />
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                    {new Date(log.createdAt).toLocaleString('tr-TR')}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                  {formatted.title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  {formatted.detail}
                                </Typography>
                              </Paper>
                            );
                          })}
                        </Box>
                        {(data.auditLogs?.length || 0) > ITEMS_PER_PAGE && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Pagination
                              size="small"
                              count={Math.ceil(data.auditLogs.length / ITEMS_PER_PAGE)}
                              page={auditPage}
                              onChange={(_, p) => setAuditPage(p)}
                              color="primary"
                            />
                          </Box>
                        )}
                      </Grid>

                      <Grid size={{ xs: 12, md: 6 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            2. Yönetici Müdahale Logları (Son 180 Gün)
                          </Typography>
                          <Chip label={`${data.adminActions?.length || 0} Kayıt`} size="small" />
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {paginatedAdminLogs.map((act) => (
                            <Paper key={act.id} variant="outlined" sx={{ p: 2, borderRadius: 2, flexShrink: 0 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                                <Chip label={act.actionType} size="small" color="secondary" sx={{ fontWeight: 700, height: 22 }} />
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  {new Date(act.createdAt).toLocaleString('tr-TR')}
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                {act.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                İşlemi Yapan Yetkili: {act.admin?.fullName} ({act.admin?.email})
                              </Typography>
                            </Paper>
                          ))}
                        </Box>
                        {(data.adminActions?.length || 0) > ITEMS_PER_PAGE && (
                          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <Pagination
                              size="small"
                              count={Math.ceil(data.adminActions.length / ITEMS_PER_PAGE)}
                              page={adminLogPage}
                              onChange={(_, p) => setAdminLogPage(p)}
                              color="secondary"
                            />
                          </Box>
                        )}
                      </Grid>
                    </Grid>
                  </>
                )}
              </Box>
            )}
          </Box>
        </Card>
      </Container>

      <Box sx={{ '@media print': { display: 'none' } }}>
        <Footer />
      </Box>

      {/* MADDE 7: Var Olan Odanın İsmini, Kodunu ve Kapasitesini Düzenleme Modalı */}
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

      {/* MADDE 6: Dönemsel veya Gün Seçmeli Banlama Modalı */}
      <Dialog
        open={banDialog.open}
        onClose={() => setBanDialog({ ...banDialog, open: false })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>
          Öğrenciyi Yasakla (Süreli / Dönemsel Ban)
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{banDialog.fullName}</strong> ({banDialog.email}) öğrencisi için uygulanacak ban süresini seçiniz:
          </Typography>
          <Select
            size="small"
            fullWidth
            value={banDialog.banDuration}
            onChange={(e) => setBanDialog({ ...banDialog, banDuration: e.target.value })}
          >
            <MenuItem value="7">7 Gün Banla (1 Hafta)</MenuItem>
            <MenuItem value="14">14 Gün Banla (2 Hafta)</MenuItem>
            <MenuItem value="30">30 Gün Banla (1 Ay)</MenuItem>
            <MenuItem value="SEMESTER">Dönemsel Banla (Dönem Sonuna Kadar - 180 Gün)</MenuItem>
          </Select>
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
                  banDuration: banDialog.banDuration,
                  banReason: banDialog.banReason,
                },
                'Öğrenci seçilen süre boyunca banlandı ve bilgilendirme e-postası gönderildi.'
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