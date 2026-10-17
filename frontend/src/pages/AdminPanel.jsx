import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Button, Chip, Tabs, Tab,
  Switch, TextField, Select, MenuItem, CircularProgress, Alert,
  Snackbar, Divider, IconButton, Tooltip
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

const STAFF_ROLES = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'];

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
  const [data, setData] = useState({ rooms: [], reservations: [], announcements: [], users: [], rules: [], auditLogs: [] });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

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
      await api.post('/admin/manage', { action, payload });
      setSnack({ open: true, message: successMsg, severity: 'success' });
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
        {/* Üst Başlık ve Rol Rozeti */}
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
                  ? (isEn ? 'Full System Access (IT / Super Admin): Rooms, Rules, Roles & Audit Logs' : 'Tam Sistem Yetkisi (BİM Super Admin): Odalar, Kurallar, Roller ve Denetim Logları')
                  : isAdminOrSuper
                  ? (isEn ? 'Library Director Access: Rooms, Reservations, Penalties & Bans' : 'Kütüphane İdaresi Yetkisi: Odalar, Rezervasyonlar, Ceza ve Ban Yönetimi')
                  : (isEn ? 'Librarian Desk Access: Check-in, Room Status & Announcements' : 'Kütüphane Görevlisi Yetkisi: Check-in, Oda Aç/Kapat ve Duyurular')}
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
            { label: isEn ? 'Banned Students' : 'Banlı Kullanıcı Sayısı', val: data.users.filter(u => u.isBanned).length, color: 'error.main' },
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
            <Tab icon={<EventNoteIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Reservations' : 'Rezervasyon Müdahale'} />
            <Tab icon={<MeetingRoomIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Rooms (Open/Close)' : 'Odaları Aç / Kapat'} />
            <Tab icon={<CampaignIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Announcements' : 'Duyuru Yayınla'} />
            <Tab icon={<PeopleAltIcon fontSize="small" />} iconPosition="start" label={isEn ? 'Penalties, Bans & Roles' : 'Öğrenci Ceza, Ban & Rol'} />
            {isAdminOrSuper && (
              <Tab icon={<SecurityIcon fontSize="small" />} iconPosition="start" label={isSuperAdmin ? (isEn ? 'Rules & Audit Logs' : 'Kurallar & BİM Denetim Logları') : (isEn ? 'System Rules' : 'Rezervasyon Kuralları')} />
            )}
          </Tabs>

          <Box sx={{ p: { xs: 2, md: 3 } }}>
            {/* ================= SEKME 0: REZERVASYON MÜDAHALE ================= */}
            {tab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.reservations.length === 0 ? (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                    {isEn ? 'No reservations found.' : 'Sistemde henüz rezervasyon kaydı bulunmuyor.'}
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
                              {isEn ? 'Organizer' : 'Organizatör'}: <strong>{res.user?.fullName}</strong> ({res.user?.email}) — {1 + (res.participants?.length || 0)} {isEn ? 'People' : 'Kişi'}
                            </Typography>
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
                                  {isEn ? 'Force Check-In' : 'Manuel Check-In'}
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={<GavelIcon />}
                                onClick={() => runAction('MARK_NO_SHOW', { reservationId: res.id, points: 15 }, 'No-Show işlendi ve +15 ceza puanı eklendi.')}
                              >
                                {isEn ? 'No-Show (+15 Pts)' : 'Gelmedi (+15 Ceza)'}
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<CancelIcon />}
                                onClick={() => runAction('CANCEL_RESERVATION', { reservationId: res.id }, 'Rezervasyon iptal edildi.')}
                              >
                                {isEn ? 'Cancel' : 'İptal Et'}
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
                      label={isEn ? 'Room Code (e.g. R105)' : 'Oda Kodu (Örn: R105)'}
                      size="small"
                      value={newRoom.roomNumber}
                      onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
                      sx={{ bgcolor: 'background.paper' }}
                    />
                    <TextField
                      label={isEn ? 'Room Name (e.g. Hezarfen)' : 'Oda Adı (Örn: Hezarfen)'}
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
                      {isEn ? 'Add Room' : 'Oda Ekle'}
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
                            label={room.isActive ? (isEn ? 'OPEN' : 'AKTİF (AÇIK)') : (isEn ? 'CLOSED' : 'BAKIMDA (KAPALI)')}
                            size="small"
                            color={room.isActive ? 'success' : 'error'}
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {isEn ? 'Max Capacity' : 'Maksimum Kapasite'}: {room.capacity}
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
                  <Typography sx={{ fontWeight: 700, mb: 2 }}>
                    {isEn ? 'Publish New Library Announcement (TR / EN)' : 'Yeni Kütüphane Duyurusu Yayınla (TR / EN)'}
                  </Typography>
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
                        {isEn ? 'Publish Announcement' : 'Duyuruyu Yayınla'}
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
                          <Typography sx={{ fontWeight: 700 }}>{isEn ? (ann.title?.en || ann.title?.tr) : (ann.title?.tr || ann.title)}</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {isEn ? (ann.content?.en || ann.content?.tr) : (ann.content?.tr || ann.content)}
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

            {/* ================= SEKME 3: ÖĞRENCİ CEZA PUANI, BAN AÇMA/KAPAMA & ROL ================= */}
            {tab === 3 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {data.users.map((u) => (
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

                        {/* Ceza Puanı Rozeti Her Zaman Görünür */}
                        <Chip
                          icon={<GavelIcon sx={{ fontSize: '14px !important' }} />}
                          label={`${isEn ? 'Penalty Points' : 'Ceza Puanı'}: ${u.penaltyPoints || 0}`}
                          size="small"
                          color={u.penaltyPoints > 0 ? 'warning' : 'default'}
                          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }}
                        />

                        {/* Ban Durumu Rozeti */}
                        {u.isBanned ? (
                          <Chip
                            label={isEn ? 'BANNED (BLOCKED)' : 'BANLI (YASAKLI)'}
                            size="small"
                            color="error"
                            sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                          />
                        ) : (
                          <Chip
                            label={isEn ? 'ACTIVE' : 'AKTİF'}
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700 }}
                          />
                        )}
                      </Box>

                      <Typography variant="body2" color="text.secondary">
                        {u.email} {u.studentNumber ? `• No: ${u.studentNumber}` : ''} {u.department ? `• ${u.department}` : ''}
                      </Typography>
                    </Box>

                    {/* Yetkili Aksiyon Butonları (ADMIN & SUPER_ADMIN) */}
                    {isAdminOrSuper ? (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Rol Değiştirme Seçici */}
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

                        {/* +10 Ceza Puanı Ekle */}
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => runAction('UPDATE_USER', { targetUserId: u.id, addPenaltyPoints: 10 }, '+10 Ceza puanı eklendi.')}
                        >
                          +10 Ceza
                        </Button>

                        {/* Ceza Puanı Sıfırla */}
                        {u.penaltyPoints > 0 && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="info"
                            startIcon={<RestartAltIcon />}
                            onClick={() => runAction('UPDATE_USER', { targetUserId: u.id, resetPenalties: true }, 'Ceza puanları sıfırlandı.')}
                          >
                            {isEn ? 'Reset Points' : 'Cezayı Sıfırla'}
                          </Button>
                        )}

                        {/* Banla veya Banı Kaldır (Ban Aç) */}
                        <Button
                          size="small"
                          variant="contained"
                          color={u.isBanned ? 'success' : 'error'}
                          startIcon={u.isBanned ? <LockOpenIcon /> : <BlockIcon />}
                          onClick={() =>
                            runAction(
                              'UPDATE_USER',
                              { targetUserId: u.id, isBanned: !u.isBanned },
                              u.isBanned ? 'Kullanıcının banı (yasağı) kaldırıldı!' : 'Kullanıcı banlandı!'
                            )
                          }
                        >
                          {u.isBanned ? (isEn ? 'Unban User' : 'Banı Aç (Yasağı Kaldır)') : (isEn ? 'Ban User' : 'Banla')}
                        </Button>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {isEn ? 'View Only (Requires Admin to Edit)' : 'Sadece Görüntüleme (Müdahale için İdare/Admin yetkisi gerekir)'}
                      </Typography>
                    )}
                  </Card>
                ))}
              </Box>
            )}

            {/* ================= SEKME 4: KURALLAR (ADMIN) & DENETİM LOGLARI (SUPER_ADMIN) ================= */}
            {tab === 4 && isAdminOrSuper && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Dinamik Kural Yönetimi */}
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                    {isEn ? 'Dynamic Reservation Rules (Admin & Super Admin)' : 'Dinamik Rezervasyon Kuralları (İdare & Sistem Yöneticisi)'}
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

                {/* Sadece BİM SUPER_ADMIN İçin Denetim İzi (Audit Logs) */}
                {isSuperAdmin && (
                  <Box>
                    <Divider sx={{ mb: 3 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main' }}>
                      {isEn ? 'IT Super Admin Audit Logs (Recent Actions)' : 'THKÜ BİM Sistem Denetim Logları (Sadece SUPER_ADMIN Görebilir)'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {data.auditLogs?.map((log) => (
                        <Card key={log.id} sx={{ p: 1.5, bgcolor: 'action.hover', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label={log.actionType} size="small" color="primary" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{log.description}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            İşlemi Yapan: {log.admin?.fullName} ({log.admin?.role}) • {new Date(log.createdAt).toLocaleTimeString('tr-TR')}
                          </Typography>
                        </Card>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Card>
      </Container>

      <Footer />

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}