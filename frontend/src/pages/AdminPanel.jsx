import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Button, Chip, Tabs, Tab,
  Switch, TextField, Select, MenuItem, CircularProgress, Alert,
  Snackbar, Divider, IconButton, Tooltip, Pagination
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import GavelIcon from '@mui/icons-material/Gavel';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import BlockIcon from '@mui/icons-material/Block';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import MoreTimeIcon from '@mui/icons-material/MoreTime';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

const STAFF_ROLES = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'];
const LOGS_PER_PAGE = 10;

// Ham JSON loglarını herkesin anlayacağı sade Türkçe cümlelere çeviren yardımcı fonksiyon
function formatReadableAuditLog(uLog) {
  const d = uLog.newData || {};
  const old = uLog.oldData || {};

  switch (uLog.action) {
    case 'RESERVATION_CREATED': {
      const invited = Array.isArray(d.invitedParticipants) && d.invitedParticipants.length > 0
        ? ` • Davet Edilenler: ${d.invitedParticipants.join(', ')}`
        : '';
      return {
        badgeLabel: 'REZERVASYON OLUŞTURULDU',
        badgeColor: 'primary',
        summary: `${d.room || 'Çalışma Odası'} için ${d.date || ''} (${d.time || ''}) saatlerine yeni rezervasyon talebi açtı${invited}.`,
      };
    }
    case 'INVITATION_ACCEPTED':
      return {
        badgeLabel: 'DAVET KABUL EDİLDİ',
        badgeColor: 'success',
        summary: `${d.room || 'Oda'} çalışma grubu davetini onayladı ve rezervasyona katıldı.`,
      };
    case 'INVITATION_REJECTED':
      return {
        badgeLabel: 'DAVET REDDEDİLDİ',
        badgeColor: 'warning',
        summary: `${d.room || 'Oda'} çalışma grubu davetini reddetti.`,
      };
    case 'RESERVATION_EARLY_CHECKOUT':
      return {
        badgeLabel: 'ODA ERKEN BOŞALTILDI',
        badgeColor: 'info',
        summary: `${d.room || 'Oda'} kullanımını erken sonlandırdı ve odayı diğer öğrencilerin kullanımına açtı.`,
      };
    case 'RESERVATION_CANCELLED':
      return {
        badgeLabel: 'REZERVASYON İPTALİ',
        badgeColor: 'error',
        summary: `${old.room || 'Oda'} rezervasyonunu iptal etti. (${d.reason || 'Kullanıcı iptali'})`,
      };
    default:
      return {
        badgeLabel: uLog.action,
        badgeColor: 'default',
        summary: 'Sistem işlemi gerçekleştirildi.',
      };
  }
}

function formatAdminActionBadge(actionType) {
  const map = {
    USER_BANNED: { label: 'KULLANICI BANLANDI', color: 'error' },
    USER_UNBANNED: { label: 'YASAK KALDIRILDI', color: 'success' },
    PENALTY_ADDED: { label: 'CEZA PUANI EKLENDİ', color: 'warning' },
    PENALTY_REMOVED: { label: 'CEZA SIFIRLANDI', color: 'info' },
    RESERVATION_CANCELLED: { label: 'REZERVASYON KAPATILDI', color: 'error' },
    RESERVATION_FORCE_CHECKIN: { label: 'MANUEL CHECK-IN', color: 'success' },
    ROOM_CREATED: { label: 'YENİ ODA EKLENDİ', color: 'primary' },
    ROOM_UPDATED: { label: 'ODA GÜNCELLENDİ', color: 'primary' },
    ROOM_DEACTIVATED: { label: 'ODA BAKIMA ALINDI', color: 'warning' },
    SETTINGS_UPDATED: { label: 'KURAL / SÜRE GÜNCELLENDİ', color: 'info' },
    USER_ROLE_CHANGED: { label: 'ROL DEĞİŞTİRİLDİ', color: 'primary' },
  };
  return map[actionType] || { label: actionType, color: 'primary' };
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status } = useSession();
  const { i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const currentRole = session?.user?.role || 'STUDENT';
  const isAdminOrSuper = ['ADMIN', 'SUPER_ADMIN'].includes(currentRole);
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    rooms: [],
    reservations: [],
    announcements: [],
    users: [],
    rules: [],
    auditLogs: [],
    userAuditLogs: [],
  });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // 10'arlı Log Sayfalama (Pagination) State'leri
  const [userLogPage, setUserLogPage] = useState(1);
  const [adminLogPage, setAdminLogPage] = useState(1);

  const [newRoom, setNewRoom] = useState({ roomNumber: '', name: '', capacity: 7 });
  const [newAnn, setNewAnn] = useState({ titleTr: '', titleEn: '', contentTr: '', contentEn: '', priority: 'HIGH', isPinned: true });

  const fetchAdminData = useCallback(async () => {
    try {
      const res = await api.get('/admin/manage');
      setData(res.data);
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.error || 'Yönetim verileri alınamadı.',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { navigate('/'); return; }
    if (!STAFF_ROLES.includes(session?.user?.role)) { navigate('/dashboard'); return; }
    fetchAdminData();
  }, [status, session, navigate, fetchAdminData]);

  const runAction = async (action, payload, successMsg) => {
    try {
      const res = await api.post('/admin/manage', { action, payload });
      const extraBanMsg =
        res.data?.autoBannedEmails?.length > 0
          ? ` (3. No-Show dolduğu için 30 gün otomatik banlananlar: ${res.data.autoBannedEmails.join(', ')})`
          : '';
      setSnack({ open: true, message: `${successMsg}${extraBanMsg}`, severity: 'success' });
      fetchAdminData();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.error || 'İşlem başarısız.',
        severity: 'error',
      });
    }
  };

  const fmtTime = (timeStr) => {
    const d = new Date(timeStr);
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isEn ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  };

  // Sayfalanmış (10'arlı) Log Listeleri
  const totalUserLogs = data.userAuditLogs?.length || 0;
  const pagedUserLogs = (data.userAuditLogs || []).slice(
    (userLogPage - 1) * LOGS_PER_PAGE,
    userLogPage * LOGS_PER_PAGE
  );

  const totalAdminLogs = data.auditLogs?.length || 0;
  const pagedAdminLogs = (data.auditLogs || []).slice(
    (adminLogPage - 1) * LOGS_PER_PAGE,
    adminLogPage * LOGS_PER_PAGE
  );

  if (status === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <Container maxWidth="lg" sx={{ pt: 4, pb: 6, flex: 1 }}>
        {/* Üst Başlık */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { sm: 'center' }, gap: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
              <AdminPanelSettingsIcon fontSize="medium" />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {isEn ? 'Library Management Panel' : 'Kütüphane Yönetim Paneli'}
                </Typography>
                <Chip label={currentRole} color="primary" size="small" sx={{ fontWeight: 700 }} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {isSuperAdmin
                  ? 'BİM Tam Yetki (SUPER_ADMIN): Odalar, Rezervasyon Uzatma/Kapatma, 3 No-Show Oto-Ban ve Tüm Sistem Logları'
                  : isAdminOrSuper
                  ? 'Kütüphane İdaresi (ADMIN): Odalar, Rezervasyon Müdahalesi, Ceza ve Ban Yönetimi'
                  : 'Kütüphane Görevlisi (LIBRARIAN): Check-in, Süre Uzatma, Oda Aç/Kapat ve Duyurular'}
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            color="primary"
            startIcon={<QrCode2Icon />}
            onClick={() => window.open('/kiosk', '_blank')}
            sx={{ borderRadius: 2, fontWeight: 700, whiteSpace: 'nowrap' }}
          >
            {isEn ? 'Open Kiosk QR Screen' : 'Kiosk QR Ekranını Aç'}
          </Button>
        </Box>

        {/* Özet Kartlar */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
          {[
            { label: isEn ? 'Active Rooms' : 'Aktif Çalışma Odası', val: `${data.rooms.filter(r => r.isActive).length} / ${data.rooms.length}`, color: 'primary.main' },
            { label: isEn ? 'Active Bookings' : 'Aktif Rezervasyon', val: data.reservations.filter(r => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status)).length, color: 'success.main' },
            { label: isEn ? 'Banned Users' : 'Banlı Öğrenci Sayısı', val: data.users.filter(u => u.isBanned).length, color: 'error.main' },
            { label: isEn ? 'Total Users' : 'Kayıtlı Kullanıcı', val: data.users.length, color: 'text.primary' },
          ].map((stat) => (
            <Card key={stat.label} sx={{ p: 2.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {stat.label}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: stat.color, mt: 0.5 }}>
                {stat.val}
              </Typography>
            </Card>
          ))}
        </Box>

        {/* Sekmeler */}
        <Card sx={{ mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Tab icon={<EventNoteIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Reservations' : 'Rezervasyon Müdahale (Uzat/Kapat)'} />
            <Tab icon={<MeetingRoomIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Rooms (Open/Close)' : 'Odaları Aç / Kapat'} />
            <Tab icon={<CampaignIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Announcements' : 'Duyuru Yayınla'} />
            <Tab icon={<PeopleAltIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Penalties, Bans & Roles' : 'Öğrenci Ceza, Ban & Rol'} />
            {isAdminOrSuper && (
              <Tab icon={<SecurityIcon fontSize="small" />} iconPosition="start" label={isSuperAdmin ? 'Kurallar & Tüm Sistem Logları (SUPER_ADMIN)' : 'Rezervasyon Kuralları'} />
            )}
          </Tabs>

          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {/* ================= SEKME 0: REZERVASYON MÜDAHALE ================= */}
            {tab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.reservations.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    Sistemde henüz rezervasyon kaydı bulunmuyor.
                  </Typography>
                ) : (
                  data.reservations.map((res) => {
                    const isActive = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(res.status);
                    const statusColor =
                      res.status === 'CHECKED_IN' || res.status === 'CONFIRMED'
                        ? 'success'
                        : res.status === 'PENDING'
                        ? 'warning'
                        : 'error';

                    const acceptedMembers = (res.participants || []).filter(p => p.status === 'ACCEPTED');

                    return (
                      <Card key={res.id} sx={{ p: 2.5, borderLeft: `4px solid ${theme.palette[statusColor].main}` }}>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2 }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
                              <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>
                                {res.room?.roomNumber} - {res.room?.name}
                              </Typography>
                              <Chip
                                label={res.status}
                                size="small"
                                sx={{ bgcolor: alpha(theme.palette[statusColor].main, 0.12), color: `${statusColor}.main`, fontWeight: 700 }}
                              />
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                {fmtDate(res.reservationDate)} | {fmtTime(res.startTime)} - {fmtTime(res.endTime)}
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              Organizatör: <strong>{res.user?.fullName}</strong> ({res.user?.email}) — Onaylı Üye: {1 + acceptedMembers.length} Kişi
                            </Typography>
                            {res.participants?.length > 0 && (
                              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                                {res.participants.map((p, idx) => (
                                  <Chip
                                    key={idx}
                                    label={`${p.user?.email} (${p.status})`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>

                          {isActive && (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {res.status !== 'CHECKED_IN' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="success"
                                  startIcon={<CheckCircleIcon />}
                                  onClick={() => runAction('FORCE_CHECKIN', { reservationId: res.id }, 'Manuel Check-In yapıldı.')}
                                >
                                  Manuel Check-In
                                </Button>
                              )}

                              <Button
                                size="small"
                                variant="outlined"
                                color="primary"
                                startIcon={<MoreTimeIcon />}
                                onClick={() => runAction('EXTEND_RESERVATION', { reservationId: res.id, extraHours: 1 }, 'Rezervasyon süresi +1 saat uzatıldı.')}
                              >
                                +1 Saat Uzat
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                color="info"
                                startIcon={<ExitToAppIcon />}
                                onClick={() => runAction('EARLY_CLOSE_RESERVATION', { reservationId: res.id }, 'Oda erken boşaltıldı ve diğer öğrencilere açıldı.')}
                              >
                                Erken Bitir (Boşalt)
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<GavelIcon />}
                                onClick={() =>
                                  runAction(
                                    'MARK_NO_SHOW',
                                    { reservationId: res.id, points: 15 },
                                    'Tüm onaylı üyelere No-Show (+15 Ceza Puanı) işlendi.'
                                  )
                                }
                              >
                                No-Show (Gruba +15 Ceza)
                              </Button>

                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<CancelIcon />}
                                onClick={() => runAction('CANCEL_RESERVATION', { reservationId: res.id }, 'Rezervasyon iptal edildi.')}
                              >
                                İptal Et
                              </Button>
                            </Box>
                          )}
                        </Box>
                      </Card>
                    );
                  })
                )}
              </Box>
            )}

            {/* ================= SEKME 1: ODALARI AÇ / KAPAT ================= */}
            {tab === 1 && (
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
                        setNewRoom({ roomNumber: '', name: '', capacity: 7 });
                      }}
                      sx={{ whiteSpace: 'nowrap', py: 1 }}
                    >
                      Oda Ekle
                    </Button>
                  </Box>
                )}

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  {data.rooms.map((room) => (
                    <Card key={room.id} sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${room.isActive ? theme.palette.success.main : theme.palette.error.main}` }}>
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
                          Maksimum Kapasite: {room.capacity} Kişi
                        </Typography>
                      </Box>

                      <Tooltip title={room.isActive ? 'Odayı Kapat' : 'Odayı Aç'}>
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
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {/* ================= SEKME 2: DUYURU YAYINLA ================= */}
            {tab === 2 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Card sx={{ p: 2.5, bgcolor: 'action.hover', border: 'none' }}>
                  <Typography sx={{ fontWeight: 700, mb: 2 }}>Yeni Kütüphane Duyurusu Yayınla (TR / EN)</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                      <TextField
                        label="Türkçe Başlık"
                        size="small"
                        fullWidth
                        value={newAnn.titleTr}
                        onChange={(e) => setNewAnn({ ...newAnn, titleTr: e.target.value })}
                        sx={{ bgcolor: 'background.paper' }}
                      />
                      <TextField
                        label="İngilizce Başlık (Opsiyonel)"
                        size="small"
                        fullWidth
                        value={newAnn.titleEn}
                        onChange={(e) => setNewAnn({ ...newAnn, titleEn: e.target.value })}
                        sx={{ bgcolor: 'background.paper' }}
                      />
                      <Select
                        size="small"
                        value={newAnn.priority}
                        onChange={(e) => setNewAnn({ ...newAnn, priority: e.target.value })}
                        sx={{ minWidth: 160, bgcolor: 'background.paper' }}
                      >
                        <MenuItem value="LOW">Düşük Öncelik</MenuItem>
                        <MenuItem value="MEDIUM">Normal Duyuru</MenuItem>
                        <MenuItem value="HIGH">Önemli (Kırmızı)</MenuItem>
                        <MenuItem value="URGENT">Acil Uyarı</MenuItem>
                      </Select>
                    </Box>
                    <TextField
                      label="Türkçe Duyuru İçeriği"
                      size="small"
                      multiline
                      rows={2}
                      fullWidth
                      value={newAnn.contentTr}
                      onChange={(e) => setNewAnn({ ...newAnn, contentTr: e.target.value })}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField
                      label="İngilizce Duyuru İçeriği (Opsiyonel)"
                      size="small"
                      multiline
                      rows={2}
                      fullWidth
                      value={newAnn.contentEn}
                      onChange={(e) => setNewAnn({ ...newAnn, contentEn: e.target.value })}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="contained"
                        startIcon={<CampaignIcon />}
                        onClick={() => {
                          runAction('CREATE_ANNOUNCEMENT', newAnn, 'Duyuru başarıyla yayınlandı.');
                          setNewAnn({ titleTr: '', titleEn: '', contentTr: '', contentEn: '', priority: 'HIGH', isPinned: true });
                        }}
                      >
                        Duyuruyu Yayınla
                      </Button>
                    </Box>
                  </Box>
                </Card>

                <Divider />

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {data.announcements.map((ann) => (
                    <Card key={ann.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label={ann.priority} size="small" color={ann.priority === 'HIGH' || ann.priority === 'URGENT' ? 'error' : 'primary'} sx={{ height: 20, fontSize: '0.65rem' }} />
                          <Typography sx={{ fontWeight: 700 }}>{ann.title?.tr || ann.title}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {ann.content?.tr || ann.content}
                        </Typography>
                      </Box>
                      <IconButton
                        color="error"
                        onClick={() => runAction('DELETE_ANNOUNCEMENT', { announcementId: ann.id }, 'Duyuru kaldırıldı.')}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Card>
                  ))}
                </Box>
              </Box>
            )}

            {/* ================= SEKME 3: ÖĞRENCİ CEZA, NO-SHOW SAYACI, BAN AÇ/KAPAT ================= */}
            {tab === 3 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {data.users.map((u) => {
                  const noShowCount = u._count?.penaltyHistory || 0;
                  return (
                    <Card
                      key={u.id}
                      sx={{
                        p: 2.5,
                        borderLeft: `4px solid ${u.isBanned ? theme.palette.error.main : u.penaltyPoints > 0 ? theme.palette.warning.main : theme.palette.primary.main}`,
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { md: 'center' },
                        gap: 2,
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{u.fullName}</Typography>
                          <Chip label={u.role} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />

                          <Chip
                            icon={<GavelIcon sx={{ fontSize: '14px !important' }} />}
                            label={`Ceza Puanı: ${u.penaltyPoints || 0}`}
                            size="small"
                            color={u.penaltyPoints > 0 ? 'warning' : 'default'}
                            sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }}
                          />

                          <Chip
                            label={`No-Show Sayacı: ${noShowCount} / 3`}
                            size="small"
                            color={noShowCount >= 3 ? 'error' : noShowCount > 0 ? 'warning' : 'default'}
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                          />

                          {u.isBanned ? (
                            <Chip
                              label={`BANLI (${u.banUntil ? new Date(u.banUntil).toLocaleDateString('tr-TR') : '30 Gün'})`}
                              size="small"
                              color="error"
                              sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                            />
                          ) : (
                            <Chip label="AKTİF" size="small" color="success" variant="outlined" sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700 }} />
                          )}
                        </Box>

                        <Typography variant="body2" color="text.secondary">
                          {u.email} {u.studentNumber ? `• No: ${u.studentNumber}` : ''} {u.department ? `• ${u.department}` : ''}
                        </Typography>
                      </Box>

                      {isAdminOrSuper ? (
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Select
                            size="small"
                            value={u.role}
                            disabled={!isSuperAdmin && ['ADMIN', 'SUPER_ADMIN'].includes(u.role)}
                            onChange={(e) => runAction('UPDATE_USER', { targetUserId: u.id, role: e.target.value }, 'Kullanıcı rolü güncellendi.')}
                            sx={{ fontSize: '0.75rem', height: 32, minWidth: 130 }}
                          >
                            <MenuItem value="STUDENT">STUDENT</MenuItem>
                            <MenuItem value="LIBRARIAN">LIBRARIAN</MenuItem>
                            {isSuperAdmin && <MenuItem value="ADMIN">ADMIN</MenuItem>}
                            {isSuperAdmin && <MenuItem value="SUPER_ADMIN">SUPER_ADMIN</MenuItem>}
                          </Select>

                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => runAction('UPDATE_USER', { targetUserId: u.id, addPenaltyPoints: 10 }, '+10 Ceza puanı eklendi.')}
                          >
                            +10 Ceza
                          </Button>

                          {(u.penaltyPoints > 0 || noShowCount > 0) && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="info"
                              startIcon={<RestartAltIcon />}
                              onClick={() => runAction('UPDATE_USER', { targetUserId: u.id, resetPenalties: true }, 'Ceza puanları ve No-Show sayacı sıfırlandı.')}
                            >
                              Cezayı Sıfırla
                            </Button>
                          )}

                          <Button
                            size="small"
                            variant="contained"
                            color={u.isBanned ? 'success' : 'error'}
                            startIcon={u.isBanned ? <LockOpenIcon /> : <BlockIcon />}
                            onClick={() =>
                              runAction(
                                'UPDATE_USER',
                                { targetUserId: u.id, isBanned: !u.isBanned },
                                u.isBanned ? 'Kullanıcının banı (yasağı) kaldırıldı!' : 'Kullanıcı 30 gün süreyle banlandı!'
                              )
                            }
                          >
                            {u.isBanned ? 'Banı Aç (Yasağı Kaldır)' : 'Banla (30 Gün)'}
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          Sadece Görüntüleme (Müdahale için İdare/Admin yetkisi gerekir)
                        </Typography>
                      )}
                    </Card>
                  );
                })}
              </Box>
            )}

            {/* ================= SEKME 4: KURALLAR & SADE TÜRKÇE SİSTEM LOGLARI (10'ARLI SAYFALAMA) ================= */}
            {tab === 4 && isAdminOrSuper && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Dinamik Rezervasyon Kuralları
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                    {data.rules.map((rule) => (
                      <Card key={rule.id} sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{rule.ruleName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Aktif Değer: <strong>{rule.ruleValue?.value}</strong>
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() =>
                              runAction(
                                'UPDATE_RULE',
                                { ruleName: rule.ruleName, value: Math.max(1, (rule.ruleValue?.value || 1) - 1) },
                                `${rule.ruleName} güncellendi.`
                              )
                            }
                          >
                            -1
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() =>
                              runAction(
                                'UPDATE_RULE',
                                { ruleName: rule.ruleName, value: (rule.ruleValue?.value || 1) + 1 },
                                `${rule.ruleName} güncellendi.`
                              )
                            }
                          >
                            +1
                          </Button>
                        </Box>
                      </Card>
                    ))}
                  </Box>
                </Box>

                {/* Sadece SUPER_ADMIN İçin Okunabilir Türkçe & 10'arlı Sayfalanmış Loglar */}
                {isSuperAdmin && (
                  <>
                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          1. Öğrenci & Sistem Hareket Logları (Son {LOGS_PER_PAGE} Kayıt / Toplam: {totalUserLogs})
                        </Typography>
                        <Chip
                          label="Saklama Politikası: 90 Gün Aktif DB • 1 Yıl Arşiv"
                          size="small"
                          variant="outlined"
                          color="primary"
                          sx={{ fontSize: '0.7rem', fontWeight: 600 }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        {pagedUserLogs.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">Henüz sistem hareket kaydı yok.</Typography>
                        ) : (
                          pagedUserLogs.map((uLog) => {
                            const formatted = formatReadableAuditLog(uLog);
                            return (
                              <Card key={uLog.id} sx={{ p: 2, bgcolor: 'background.default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                    <Chip
                                      label={formatted.badgeLabel}
                                      size="small"
                                      color={formatted.badgeColor}
                                      sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
                                    />
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                      {uLog.user?.fullName || 'Kullanıcı'} ({uLog.user?.email})
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" color="text.secondary" sx={{ pl: 0.5 }}>
                                    {formatted.summary}
                                  </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                  {new Date(uLog.createdAt).toLocaleString('tr-TR')}
                                </Typography>
                              </Card>
                            );
                          })
                        )}
                      </Box>

                      {totalUserLogs > LOGS_PER_PAGE && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Pagination
                            count={Math.ceil(totalUserLogs / LOGS_PER_PAGE)}
                            page={userLogPage}
                            onChange={(_, p) => setUserLogPage(p)}
                            color="primary"
                            size="small"
                          />
                        </Box>
                      )}
                    </Box>

                    <Divider />
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                          2. Yönetici & Görevli Müdahale Logları (Son {LOGS_PER_PAGE} Kayıt / Toplam: {totalAdminLogs})
                        </Typography>
                      </Box>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        {pagedAdminLogs.map((log) => {
                          const badge = formatAdminActionBadge(log.actionType);
                          return (
                            <Card key={log.id} sx={{ p: 2, bgcolor: 'action.hover', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                <Chip label={badge.label} size="small" color={badge.color} sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }} />
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{log.description}</Typography>
                              </Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                Yetkili: {log.admin?.fullName} ({log.admin?.role}) • {new Date(log.createdAt).toLocaleString('tr-TR')}
                              </Typography>
                            </Card>
                          );
                        })}
                      </Box>

                      {totalAdminLogs > LOGS_PER_PAGE && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                          <Pagination
                            count={Math.ceil(totalAdminLogs / LOGS_PER_PAGE)}
                            page={adminLogPage}
                            onChange={(_, p) => setAdminLogPage(p)}
                            color="primary"
                            size="small"
                          />
                        </Box>
                      )}
                    </Box>
                  </>
                )}
              </Box>
            )}
          </Box>
        </Card>
      </Container>

      <Footer />

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}