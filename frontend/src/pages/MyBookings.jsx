import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Chip, Button, Tabs, Tab,
  CircularProgress, Alert, Snackbar, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Tooltip
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';

import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupIcon from '@mui/icons-material/Group';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EventNoteIcon from '@mui/icons-material/EventNote';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';

export default function MyBookings() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status } = useSession();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';
  const isEn = currentLang === 'en';

  const [reservations, setReservations] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Madde 14: Sonradan Üye Ekleme Modal State
  const [addMemberDialog, setAddMemberDialog] = useState({ open: false, reservationId: null, roomName: '' });
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const fetchAllData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/reservations').catch(() => ({ data: [] })),
      api.get('/invitations').catch(() => ({ data: [] })),
    ])
      .then(([resList, invList]) => {
        setReservations(resList.data || []);
        setInvitations(invList.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { navigate('/'); return; }
    fetchAllData();
  }, [status, navigate, fetchAllData]);

  const handleCancel = async (id) => {
    try {
      await api.delete(`/reservations?id=${id}`);
      setSnack({
        open: true,
        message: isEn ? 'Reservation cancelled.' : 'Rezervasyon başarıyla iptal edildi ve oda boşa çıkarıldı.',
        severity: 'info',
      });
      fetchAllData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'İptal edilemedi.', severity: 'error' });
    }
  };

  const handleEarlyCheckout = async (id) => {
    try {
      const res = await api.patch('/reservations', { reservationId: id, action: 'EARLY_CHECKOUT' });
      setSnack({
        open: true,
        message: res.data?.message || 'Oda erken boşaltıldı ve diğer öğrencilere açıldı.',
        severity: 'success',
      });
      fetchAllData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'İşlem başarısız.', severity: 'error' });
    }
  };

  // Sonradan Üye Ekleme
  const handleAddParticipantSubmit = async () => {
    if (!newMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      const res = await api.patch('/reservations', {
        reservationId: addMemberDialog.reservationId,
        action: 'ADD_PARTICIPANT',
        participantEmail: newMemberEmail.trim(),
      });
      setSnack({ open: true, message: res.data?.message || 'Yeni üye eklendi.', severity: 'success' });
      setAddMemberDialog({ open: false, reservationId: null, roomName: '' });
      setNewMemberEmail('');
      fetchAllData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'Üye eklenemedi.', severity: 'error' });
    } finally {
      setAddingMember(false);
    }
  };

  // Katılımcının Gruptan Çıkması (En Az 2 Kişi Kalana Kadar)
  const handleLeaveReservation = async (id) => {
    try {
      const res = await api.patch('/reservations', {
        reservationId: id,
        action: 'LEAVE_RESERVATION',
      });
      setSnack({ open: true, message: res.data?.message || 'Gruptan ayrıldınız.', severity: 'info' });
      fetchAllData();
    } catch (err) {
      setSnack({ open: true, message: err.response?.data?.error || 'Gruptan çıkılamadı.', severity: 'error' });
    }
  };

  const handleInvitationRespond = async (participantId, action) => {
    try {
      await api.post('/invitations/respond', { participantId, action });
      setSnack({
        open: true,
        message: action === 'ACCEPT' ? t('inviteAccepted') : t('inviteRejected'),
        severity: action === 'ACCEPT' ? 'success' : 'info',
      });
      fetchAllData();
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
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (h === 23 && m >= 59) return '24:00';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isEn ? 'en-US' : 'tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    });
  };

  //  Randevu başlangıcına 60 dakikadan az kaldı mı kontrolü
  const isWithinOneHourOfStart = (res) => {
    const now = new Date();
    const todayIso = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    const resDateIso = new Date(res.reservationDate).toISOString().split('T')[0];

    const nowEpochMins =
      Math.floor(new Date(todayIso + 'T00:00:00Z').getTime() / 60000) +
      now.getHours() * 60 +
      now.getMinutes();

    const startH = new Date(res.startTime).getUTCHours();
    const startM = new Date(res.startTime).getUTCMinutes();
    const resStartEpochMins =
      Math.floor(new Date(resDateIso + 'T00:00:00Z').getTime() / 60000) +
      startH * 60 +
      startM;

    return resStartEpochMins - nowEpochMins < 60;
  };

  const activeList = reservations.filter(r => ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status));
  const pastList = reservations.filter(r => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(r.status));

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

      <Container maxWidth="md" sx={{ pt: 4, pb: 6, flex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1.25, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
              <EventNoteIcon />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{t('navMyBookings')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {isEn
                  ? 'Manage your active sessions, add/leave group members, or free the room early.'
                  : 'Aktif randevularınızı yönetin, oda kapasitesine göre üye ekleyin/çıkın veya odayı erken boşaltın.'}
              </Typography>
            </Box>
          </Box>
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => navigate('/reserve')}>
            {t('reserveRoom')}
          </Button>
        </Box>

        <Card sx={{ mb: 3 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="fullWidth"
            sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Tab label={isEn ? `Active Bookings (${activeList.length})` : `Aktif Rezervasyonlarım (${activeList.length})`} />
            <Tab label={isEn ? `Group Invitations (${invitations.length})` : `Gelen Grup Davetleri (${invitations.length})`} />
            <Tab label={isEn ? `History & Cancelled (${pastList.length})` : `Geçmiş & İptal Edilenler (${pastList.length})`} />
          </Tabs>

          <Box sx={{ p: 3 }}>
            {(tab === 0 || tab === 2) && (
              (tab === 0 ? activeList : pastList).length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">{t('noActiveReservations')}</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(tab === 0 ? activeList : pastList).map((res) => {
                    const isOrganizer = res.userId === session?.user?.id || res.user?.email === session?.user?.email;
                    const isCancelled = res.status === 'CANCELLED' || res.status === 'NO_SHOW';
                    const isConfirmed = res.status === 'CONFIRMED' || res.status === 'CHECKED_IN';
                    const statusColor = isCancelled ? 'error' : isConfirmed ? 'success' : 'warning';

                    const activeParticipants = (res.participants || []).filter(p => p.status !== 'REJECTED');
                    const acceptedParticipants = (res.participants || []).filter(p => p.status === 'ACCEPTED');
                    const totalActiveOrPending = 1 + activeParticipants.length;
                    const totalConfirmedPeople = 1 + acceptedParticipants.length;
                    const roomCapacity = res.room?.capacity || 8;

                   
                    // 1) Organizatör ise ve oda kapasitesi (8) dolmamışsa üye ekleyebilir
                    const canAddMember = isOrganizer && ['PENDING', 'CONFIRMED'].includes(res.status) && totalActiveOrPending < roomCapacity;
                    // 2) Katılımcı ise ve içeride en az 3 onaylı kişi varsa (kendisi çıkınca >= 2 kalacaksa) gruptan çıkabilir
                    const canLeaveGroup = !isOrganizer && ['PENDING', 'CONFIRMED'].includes(res.status) && totalConfirmedPeople > 2;
                    // Madde 5: Başlangıca 1 saatten az kaldıysa iptal kilitlenir
                    const cancelLocked = isWithinOneHourOfStart(res);

                    return (
                      <Card key={res.id} sx={{ p: 2.5, flexShrink: 0, borderLeft: `4px solid ${theme.palette[statusColor].main}` }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
                              <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                                {res.room?.roomNumber} - {res.room?.name}
                              </Typography>
                              <Chip
                                label={res.status}
                                size="small"
                                sx={{ bgcolor: alpha(theme.palette[statusColor].main, 0.12), color: `${statusColor}.main`, fontWeight: 700, height: 22 }}
                              />
                              <Chip
                                label={isOrganizer ? t('youCreated') : t('youJoined')}
                                size="small"
                                variant="outlined"
                                sx={{ height: 22, fontSize: '0.7rem' }}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'text.secondary', mt: 1, flexWrap: 'wrap' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ScheduleIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">{fmtDate(res.reservationDate)} | {fmtTime(res.startTime)} - {fmtTime(res.endTime)}</Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <GroupIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">
                                  {totalConfirmedPeople} Onaylı / Maks {roomCapacity} Kişi
                                </Typography>
                              </Box>
                            </Box>

                            {res.participants?.length > 0 && (
                              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
                                {res.participants.map((p, i) => (
                                  <Chip
                                    key={i}
                                    label={`${p.user?.fullName || p.user?.email} (${p.status})`}
                                    size="small"
                                    variant="outlined"
                                    color={p.status === 'ACCEPTED' ? 'success' : p.status === 'REJECTED' ? 'error' : 'warning'}
                                    sx={{ fontSize: '0.68rem', height: 22 }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>

                          {/* Aksiyon Butonları*/}
                          {tab === 0 && (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                              {/* Organizatör İçin Sonradan Üye Ekleme Butonu (Kapasite < 8 ise görünür) */}
                              {canAddMember && (
                                <Button
                                  variant="outlined"
                                  color="primary"
                                  size="small"
                                  startIcon={<PersonAddAlt1Icon />}
                                  onClick={() =>
                                    setAddMemberDialog({
                                      open: true,
                                      reservationId: res.id,
                                      roomName: `${res.room?.roomNumber} - ${res.room?.name}`,
                                    })
                                  }
                                >
                                  + Üye Ekle ({roomCapacity - totalActiveOrPending} Boş)
                                </Button>
                              )}

                              {/* Katılımcı İçin Gruptan Çık Butonu (En az 2 kişi kalacaksa görünür) */}
                              {canLeaveGroup && (
                                <Button
                                  variant="outlined"
                                  color="warning"
                                  size="small"
                                  startIcon={<PersonRemoveIcon />}
                                  onClick={() => handleLeaveReservation(res.id)}
                                >
                                  Gruptan Çık
                                </Button>
                              )}

                              {/*Odayı Erken Boşaltma */}
                              {isOrganizer && ['CONFIRMED', 'CHECKED_IN'].includes(res.status) && (
                                <Button
                                  variant="contained"
                                  color="info"
                                  size="small"
                                  startIcon={<ExitToAppIcon />}
                                  onClick={() => handleEarlyCheckout(res.id)}
                                >
                                  {isEn ? 'Early Check-Out' : 'Odayı Erken Boşalt'}
                                </Button>
                              )}

                              {/*Son 1 Saat Kala İptal Kilidi */}
                              {isOrganizer && ['PENDING', 'CONFIRMED'].includes(res.status) && (
                                <Tooltip
                                  title={
                                    cancelLocked
                                      ? 'Randevu başlangıcına 1 saatten az kaldığı için iptal edilemez.'
                                      : 'Randevuyu iptal et'
                                  }
                                >
                                  <span>
                                    <Button
                                      variant="outlined"
                                      color="error"
                                      size="small"
                                      disabled={cancelLocked}
                                      startIcon={<CancelOutlinedIcon />}
                                      onClick={() => handleCancel(res.id)}
                                    >
                                      {cancelLocked ? 'Son 1 Saat (İptal Kilitli)' : t('cancel')}
                                    </Button>
                                  </span>
                                </Tooltip>
                              )}
                            </Box>
                          )}
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              )
            )}

            {tab === 1 && (
              invitations.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">{t('noInvitations')}</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {invitations.map((inv) => (
                    <Card key={inv.id} sx={{ p: 2.5, flexShrink: 0, borderLeft: `4px solid ${theme.palette.warning.main}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {t('invitedYouTo', { name: inv.reservation?.user?.fullName, room: `${inv.reservation?.room?.roomNumber} - ${inv.reservation?.room?.name}` })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {fmtDate(inv.reservation?.reservationDate)} | {fmtTime(inv.reservation?.startTime)} - {fmtTime(inv.reservation?.endTime)} • (30 dk içinde onaylanmalıdır)
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />} onClick={() => handleInvitationRespond(inv.id, 'ACCEPT')}>
                          {t('accept')}
                        </Button>
                        <Button size="small" variant="outlined" color="error" startIcon={<HighlightOffIcon />} onClick={() => handleInvitationRespond(inv.id, 'REJECT')}>
                          {t('reject')}
                        </Button>
                      </Box>
                    </Card>
                  ))}
                </Box>
              )
            )}
          </Box>
        </Card>
      </Container>

      <Footer />

      {/* Sonradan Üye Ekleme Pop-up Dialog */}
      <Dialog
        open={addMemberDialog.open}
        onClose={() => setAddMemberDialog({ open: false, reservationId: null, roomName: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Gruba Yeni Üye Ekle ({addMemberDialog.roomName})
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Oda kapasitesini (maks. 8 kişi) aşmayacak şekilde davet etmek istediğiniz öğrencinin kurumsal e-posta adresini giriniz:
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="sXXXXXXXXX@stu.thk.edu.tr"
            value={newMemberEmail}
            onChange={(e) => setNewMemberEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddMemberDialog({ open: false, reservationId: null, roomName: '' })} color="inherit">
            Vazgeç
          </Button>
          <Button variant="contained" onClick={handleAddParticipantSubmit} disabled={addingMember || !newMemberEmail.trim()}>
            {addingMember ? <CircularProgress size={18} color="inherit" /> : 'Davet Gönder'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}