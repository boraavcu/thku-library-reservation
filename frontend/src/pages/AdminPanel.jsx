import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Tabs, Tab, Button, Chip,
  CircularProgress, Alert, Snackbar, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem,
  IconButton, Tooltip
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';
import { isReservationEnded } from '../utils/dateUtils';

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import GavelIcon from '@mui/icons-material/Gavel';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import BarChartIcon from '@mui/icons-material/BarChart';
import SchoolIcon from '@mui/icons-material/School';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

import { THKU_LOGO_URL, STAFF_ROLES } from '../components/admin/adminConstants';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import ReservationsTab from '../components/admin/ReservationsTab';
import RoomsTab from '../components/admin/RoomsTab';
import AnnouncementsTab from '../components/admin/AnnouncementsTab';
import UsersTab from '../components/admin/UsersTab';
import RulesAndLogsTab from '../components/admin/RulesAndLogsTab';

export default function AdminPanel() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: session, status } = useSession();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const [tab, setTab] = useState(0);
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

  const [createUserDialog, setCreateUserDialog] = useState({
    open: false,
    email: '',
    fullName: '',
    role: 'LIBRARIAN',
    department: '',
    phone: '',
  });
  const [credentialDialog, setCredentialDialog] = useState({
    open: false,
    title: '',
    email: '',
    temporaryPassword: '',
    expiresAt: null,
    emailQueued: false,
  });
  const [purgeDialog, setPurgeDialog] = useState(false);

  const userRole = session?.user?.role;
  const isLibrarianOnly = userRole === 'LIBRARIAN';
  const isAdminOrSuper = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  const fetchData = useCallback(() => {
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
      return res.data;
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.error || 'İşlem başarısız oldu.',
        severity: 'error',
      });
      return null;
    }
  };

  const handleOpenCreateStaff = () => {
    setCreateUserDialog({
      open: true,
      email: '',
      fullName: '',
      role: 'LIBRARIAN',
      department: '',
      phone: '',
    });
  };

  const handleResetStaffPassword = async (staffUser) => {
    try {
      const res = await api.post('/admin/manage', {
        action: 'USER_MODERATION',
        payload: { targetUserId: staffUser.id, modType: 'RESET_STAFF_TEMP_PASSWORD' },
      });
      setCredentialDialog({
        open: true,
        title: isEn ? 'New one-time temporary password' : 'Yeni tek seferlik geçici şifre',
        email: staffUser.email,
        temporaryPassword: res.data.temporaryPassword || '',
        expiresAt: res.data.expiresAt,
        emailQueued: Boolean(res.data.emailQueued),
      });
      fetchData();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.error || (isEn ? 'Could not reset password.' : 'Şifre sıfırlanamadı.'),
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

  if (status === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeBookingsCount = (data.reservations || []).filter(
    (r) => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status) && !isReservationEnded(r)
  ).length;
  const totalStudentsCount = (data.users || []).filter((u) => u.role === 'STUDENT').length;
  const bannedUsersCount = (data.users || []).filter((u) => u.isBanned).length;

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

            {isAdminOrSuper && (
              <Button
                variant="outlined"
                color="success"
                startIcon={<PersonAddAlt1Icon />}
                onClick={handleOpenCreateStaff}
                sx={{ borderRadius: 2, fontWeight: 700, flex: { xs: 1, sm: 'none' } }}
              >
                {isEn ? 'Add Staff (@thk.edu.tr)' : 'Personel Ekle (@thk.edu.tr)'}
              </Button>
            )}

            {isAdminOrSuper && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<DeleteSweepIcon />}
                onClick={() => setPurgeDialog(true)}
                sx={{ borderRadius: 2, fontWeight: 700, flex: { xs: 1, sm: 'none' } }}
              >
                {isEn ? 'Purge demo data' : 'Demo verilerini temizle'}
              </Button>
            )}

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
            {tab === 0 && (
              <AnalyticsTab
                analytics={data.analytics}
                isEn={isEn}
                onPrintPdf={handlePrintPdfReport}
              />
            )}

            {tab === 1 && (
              <ReservationsTab
                reservations={data.reservations}
                rooms={data.rooms}
                isEn={isEn}
                runAction={runAction}
              />
            )}

            {tab === 2 && (
              <RoomsTab
                rooms={data.rooms}
                isAdminOrSuper={isAdminOrSuper}
                isEn={isEn}
                runAction={runAction}
              />
            )}

            {tab === 3 && (
              <AnnouncementsTab
                announcements={data.announcements}
                isEn={isEn}
                runAction={runAction}
              />
            )}

            {tab === 4 && (
              <UsersTab
                users={data.users}
                currentUserId={session?.user?.id}
                userRole={userRole}
                isAdminOrSuper={isAdminOrSuper}
                isSuperAdmin={isSuperAdmin}
                isEn={isEn}
                runAction={runAction}
                onOpenCreateStaff={handleOpenCreateStaff}
                onResetStaffPassword={handleResetStaffPassword}
              />
            )}

            {tab === 5 && isAdminOrSuper && (
              <RulesAndLogsTab
                rules={data.rules}
                auditLogs={data.auditLogs}
                adminActions={data.adminActions}
                logRetentionPolicy={data.logRetentionPolicy}
                isEn={isEn}
                runAction={runAction}
              />
            )}
          </Box>
        </Card>
      </Container>

      {/* Kurumsal Personel (@thk.edu.tr) Ekleme Penceresi */}
      <Dialog
        open={createUserDialog.open}
        onClose={() => setCreateUserDialog((d) => ({ ...d, open: false }))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {isEn ? 'Add Institutional Staff (@thk.edu.tr)' : 'Kurumsal Personel Ekle (@thk.edu.tr)'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary">
            {isEn
              ? 'Only @thk.edu.tr addresses (not @stu.thk.edu.tr). A one-time temporary password (48 hours) is generated, shown once on screen, and queued by email when SMTP is configured. The user must set a new password immediately after first login.'
              : 'Yalnızca @thk.edu.tr (öğrenci @stu.thk.edu.tr hariç) adresleri eklenebilir. 48 saat geçerli tek seferlik şifre üretilir, ekranda bir kez gösterilir ve SMTP ayarlıysa e-posta kuyruğuna alınır. Kullanıcı ilk girişten sonra kalıcı şifresini belirlemek zorundadır.'}
          </Typography>
          <TextField
            size="small"
            fullWidth
            label={isEn ? 'Institutional Email' : 'Kurumsal E-posta'}
            placeholder="ornek@thk.edu.tr"
            value={createUserDialog.email}
            onChange={(e) => setCreateUserDialog((d) => ({ ...d, email: e.target.value }))}
          />
          <TextField
            size="small"
            fullWidth
            label={isEn ? 'Full Name' : 'Ad Soyad'}
            value={createUserDialog.fullName}
            onChange={(e) => setCreateUserDialog((d) => ({ ...d, fullName: e.target.value }))}
          />
          <Select
            size="small"
            fullWidth
            value={createUserDialog.role}
            onChange={(e) => setCreateUserDialog((d) => ({ ...d, role: e.target.value }))}
          >
            <MenuItem value="LIBRARIAN">
              {isEn ? 'LIBRARIAN (Library Staff)' : 'LIBRARIAN (Kütüphane Görevlisi)'}
            </MenuItem>
            {isSuperAdmin && (
              <MenuItem value="ADMIN">
                {isEn ? 'ADMIN (Library Director)' : 'ADMIN (Kütüphane Müdürü)'}
              </MenuItem>
            )}
            {isSuperAdmin && (
              <MenuItem value="SUPER_ADMIN">
                {isEn ? 'SUPER_ADMIN (IT Admin)' : 'SUPER_ADMIN (BİM Yöneticisi)'}
              </MenuItem>
            )}
          </Select>
          <TextField
            size="small"
            fullWidth
            label={isEn ? 'Department / Unit (optional)' : 'Birim / Bölüm (isteğe bağlı)'}
            value={createUserDialog.department}
            onChange={(e) => setCreateUserDialog((d) => ({ ...d, department: e.target.value }))}
          />
          <TextField
            size="small"
            fullWidth
            label={isEn ? 'Phone (optional)' : 'Telefon (isteğe bağlı)'}
            value={createUserDialog.phone}
            onChange={(e) => setCreateUserDialog((d) => ({ ...d, phone: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateUserDialog((d) => ({ ...d, open: false }))} color="inherit">
            {isEn ? 'Cancel' : 'Vazgeç'}
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!createUserDialog.email.trim()}
            onClick={async () => {
              try {
                const res = await api.post('/admin/manage', {
                  action: 'CREATE_USER',
                  payload: {
                    email: createUserDialog.email,
                    fullName: createUserDialog.fullName,
                    role: createUserDialog.role,
                    department: createUserDialog.department,
                    phone: createUserDialog.phone,
                  },
                });
                setCreateUserDialog((d) => ({ ...d, open: false }));
                setCredentialDialog({
                  open: true,
                  title: isEn ? 'One-time temporary password' : 'Tek seferlik geçici şifre',
                  email: res.data.user?.email || createUserDialog.email.trim().toLowerCase(),
                  temporaryPassword: res.data.temporaryPassword || '',
                  expiresAt: res.data.expiresAt,
                  emailQueued: Boolean(res.data.emailQueued),
                });
                fetchData();
              } catch (err) {
                setSnack({
                  open: true,
                  message: err.response?.data?.error || (isEn ? 'Operation failed.' : 'İşlem başarısız oldu.'),
                  severity: 'error',
                });
              }
            }}
          >
            {isEn ? 'Save & Generate Password' : 'Kaydet ve Şifre Üret'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tek Seferlik Geçici Şifre Gösterim Penceresi */}
      <Dialog
        open={credentialDialog.open}
        onClose={() => setCredentialDialog((d) => ({ ...d, open: false, temporaryPassword: '' }))}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>{credentialDialog.title}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Alert severity="warning">
            {isEn
              ? 'This password is shown only once. Copy it now and share it with the user over a secure channel if email is not delivered.'
              : 'Bu şifre yalnızca bu pencerede bir kez gösterilir. E-posta ulaşmazsa güvenli kanaldan iletmek için şimdi kopyalayın.'}
          </Alert>
          <Typography variant="body2">
            <strong>{isEn ? 'Account:' : 'Hesap:'}</strong> {credentialDialog.email}
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              fontFamily: 'monospace',
              fontSize: '1.05rem',
              fontWeight: 800,
              wordBreak: 'break-all',
            }}
          >
            <span>{credentialDialog.temporaryPassword}</span>
            <Tooltip title={isEn ? 'Copy' : 'Kopyala'}>
              <IconButton
                size="small"
                onClick={() => {
                  if (credentialDialog.temporaryPassword) {
                    navigator.clipboard?.writeText(credentialDialog.temporaryPassword);
                    setSnack({
                      open: true,
                      message: isEn ? 'Copied to clipboard.' : 'Panoya kopyalandı.',
                      severity: 'info',
                    });
                  }
                }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          {credentialDialog.expiresAt && (
            <Typography variant="caption" color="text.secondary">
              {isEn ? 'Valid until:' : 'Geçerlilik sonu:'}{' '}
              {new Date(credentialDialog.expiresAt).toLocaleString(isEn ? 'en-GB' : 'tr-TR')}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {credentialDialog.emailQueued
              ? isEn
                ? 'An email with the same temporary password has been queued.'
                : 'Aynı geçici şifreyi içeren e-posta gönderim kuyruğuna eklendi.'
              : isEn
              ? 'Email could not be queued; please deliver the password manually.'
              : 'E-posta kuyruğa eklenemedi; şifreyi kullanıcıya güvenli biçimde iletin.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={() => setCredentialDialog((d) => ({ ...d, open: false, temporaryPassword: '' }))}
          >
            {isEn ? 'I saved it, close' : 'Kaydettim, kapat'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Demo Verilerini Temizleme Onay Penceresi */}
      <Dialog open={purgeDialog} onClose={() => setPurgeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: 'warning.main' }}>
          {isEn ? 'Purge demo and seed test data?' : 'Demo ve örnek test verileri silinsin mi?'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
          <Typography variant="body2">
            {isEn
              ? 'This removes @demo.local accounts, known seed test emails, their reservations, and seeded sample announcements. Rooms, rules, agreements, and real institutional accounts are kept.'
              : '@demo.local uzantılı hesaplar, bilinen örnek test e-postaları, bunlara bağlı rezervasyonlar ve örnek duyuru kayıtları kalıcı olarak silinir. Odalar, kurallar, sözleşme ve gerçek kurumsal hesaplar korunur.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPurgeDialog(false)} color="inherit">
            {isEn ? 'Cancel' : 'Vazgeç'}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={async () => {
              setPurgeDialog(false);
              try {
                const res = await api.post('/admin/manage', { action: 'PURGE_TEST_DATA', payload: {} });
                const s = res.data?.summary;
                setSnack({
                  open: true,
                  message: isEn
                    ? `Removed ${s?.deletedUsers ?? 0} demo users and ${s?.deletedReservations ?? 0} reservations.`
                    : `${s?.deletedUsers ?? 0} demo kullanıcı ve ${s?.deletedReservations ?? 0} rezervasyon temizlendi.`,
                  severity: 'success',
                });
                fetchData();
              } catch (err) {
                setSnack({
                  open: true,
                  message: err.response?.data?.error || (isEn ? 'Purge failed.' : 'Temizleme başarısız.'),
                  severity: 'error',
                });
              }
            }}
          >
            {isEn ? 'Yes, purge' : 'Evet, temizle'}
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ '@media print': { display: 'none' } }}>
        <Footer />
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
