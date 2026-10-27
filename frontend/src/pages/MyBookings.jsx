import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Chip, Button, Tabs, Tab,
  CircularProgress, Alert, Snackbar, Tooltip, Divider
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
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

function getReservationTimingState(res) {
  const now = new Date();
  const todayIso = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const resDateIso = new Date(res.reservationDate).toISOString().split('T')[0];

  const nowEpochMins =
    Math.floor(new Date(todayIso + 'T00:00:00Z').getTime() / 60000) +
    now.getHours() * 60 +
    now.getMinutes();

  const startH = new Date(res.startTime).getUTCHours();
  const startM = new Date(res.startTime).getUTCMinutes();
  const endDt = new Date(res.endTime);
  const endH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
  const endM = endH === 24 ? 0 : endDt.getUTCMinutes();

  const resStartEpochMins =
    Math.floor(new Date(resDateIso + 'T00:00:00Z').getTime() / 60000) +
    startH * 60 +
    startM;

  const resEndEpochMins =
    Math.floor(new Date(resDateIso + 'T00:00:00Z').getTime() / 60000) +
    endH * 60 +
    endM;

  const isHappeningNow =
    res.status === 'CHECKED_IN' ||
    (['CONFIRMED', 'CHECKED_IN'].includes(res.status) &&
      nowEpochMins >= resStartEpochMins &&
      nowEpochMins < resEndEpochMins);

  const hasStarted = nowEpochMins >= resStartEpochMins || res.status === 'CHECKED_IN';
  const cancelLocked = resStartEpochMins - nowEpochMins < 60;

  return { isHappeningNow, hasStarted, cancelLocked };
}

export default function MyBookings() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status } = useSession();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';
  const isEn = currentLang === 'en';
  const isBanned = Boolean(session?.user?.isBanned);

  const [reservations, setReservations] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

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
    // ADMIN (Müdür) ve SUPER_ADMIN (BİM) bu sayfaya erişemez, doğrudan yönetim paneline yönlendirilir
    if (['ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role)) {
      navigate('/admin', { replace: true });
      return;
    }
    fetchAllData();
  }, [status, session, navigate, fetchAllData]);

  const handleCancel = async (id) => {
    try {
      await api.delete(`/reservations?id=${id}`);
      setSnack({
        open: true,
        message: isEn
          ? 'Reservation cancelled and notification emails sent.'
          : 'Rezervasyon tüm grup için iptal edildi ve bilgilendirme mailleri gönderildi.',
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
                  ? 'View your active reservations, respond to group invitations, or check out early.'
                  : 'Aktif randevularınızı görüntüleyin, grup davetlerini yanıtlayın veya odayı erken boşaltın.'}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            disabled={isBanned}
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => !isBanned && navigate('/reserve')}
          >
            {isBanned ? (isEn ? 'Suspended' : 'Hesap Askıda') : t('reserveRoom')}
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

                    const acceptedParticipants = (res.participants || []).filter(p => p.status === 'ACCEPTED');
                    const totalConfirmedPeople = 1 + acceptedParticipants.length;
                    const roomCapacity = res.room?.capacity || 8;

                    const { isHappeningNow, hasStarted, cancelLocked } = getReservationTimingState(res);
                    const showOrganizerActions = tab === 0 && isOrganizer && ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(res.status);

                    return (
                      <Card key={res.id} sx={{ p: 2.5, flexShrink: 0, borderLeft: `4px solid ${theme.palette[statusColor].main}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
                            {res.purpose && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <DescriptionOutlinedIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {res.purpose}
                                </Typography>
                              </Box>
                            )}
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

                        {showOrganizerActions && (
                          <>
                            <Divider />
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                              {/* Odayı Erken Boşalt YALNIZCA randevu saatleri başladıktan sonra (randevu sırasında) görünür */}
                              {isHappeningNow && (
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

                              {/* İptal Et butonu randevu saati başlamadan önce görünür (Son 1 saat kala kilitlenir) */}
                              {!hasStarted && ['PENDING', 'CONFIRMED'].includes(res.status) && (
                                <Tooltip
                                  title={
                                    cancelLocked
                                      ? 'Randevu başlangıcına 1 saatten az kaldığı için iptal edilemez.'
                                      : 'Randevuyu tüm grup için iptal et'
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
                          </>
                        )}
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
                    <Card key={inv.id} sx={{ p: 2.5, flexShrink: 0, borderLeft: `4px solid ${theme.palette.warning.main}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {t('invitedYouTo', { name: inv.reservation?.user?.fullName, room: `${inv.reservation?.room?.roomNumber} - ${inv.reservation?.room?.name}` })}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {fmtDate(inv.reservation?.reservationDate)} | {fmtTime(inv.reservation?.startTime)} - {fmtTime(inv.reservation?.endTime)} • (30 dk içinde onaylanmalıdır)
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          disabled={isBanned}
                          startIcon={<CheckCircleOutlineIcon />}
                          onClick={() => handleInvitationRespond(inv.id, 'ACCEPT')}
                        >
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

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}