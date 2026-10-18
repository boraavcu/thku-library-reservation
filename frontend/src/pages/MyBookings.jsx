import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Card, Chip, Button, Tabs, Tab,
  CircularProgress, Alert, Snackbar
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
import MoreTimeIcon from '@mui/icons-material/MoreTime';

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

  // 7/24 Kütüphane: Önündeki 1 saat boşsa öğrencinin kendi süresini +1 saat uzatması
  const handleSelfExtend = async (id) => {
    try {
      const res = await api.patch('/reservations', { reservationId: id, action: 'SELF_EXTEND_1H' });
      setSnack({
        open: true,
        message: res.data?.message || 'Rezervasyon süresi +1 saat uzatıldı!',
        severity: 'success',
      });
      fetchAllData();
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.error || 'Süre uzatılamadı.',
        severity: 'error',
      });
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
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
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
                  ? 'Track your active sessions, extend time if available, or manage invitations.'
                  : 'Aktif rezervasyonlarınızı yönetin, oda müsaitse +1 saat uzatın veya erken boşaltın.'}
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
                                <Typography variant="body2">{1 + (res.participants?.length || 0)} {isEn ? 'Participants' : 'Katılımcı'}</Typography>
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

                          {tab === 0 && isOrganizer && (
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              {['CONFIRMED', 'CHECKED_IN'].includes(res.status) && (
                                <>
                                  <Button
                                    variant="outlined"
                                    color="primary"
                                    size="small"
                                    startIcon={<MoreTimeIcon />}
                                    onClick={() => handleSelfExtend(res.id)}
                                  >
                                    {isEn ? '+1h Extend' : '+1 Saat Uzat'}
                                  </Button>
                                  <Button
                                    variant="contained"
                                    color="info"
                                    size="small"
                                    startIcon={<ExitToAppIcon />}
                                    onClick={() => handleEarlyCheckout(res.id)}
                                  >
                                    {isEn ? 'Early Check-Out' : 'Odayı Erken Boşalt'}
                                  </Button>
                                </>
                              )}

                              {['PENDING', 'CONFIRMED'].includes(res.status) && (
                                <Button
                                  variant="outlined"
                                  color="error"
                                  size="small"
                                  startIcon={<CancelOutlinedIcon />}
                                  onClick={() => handleCancel(res.id)}
                                >
                                  {t('cancel')}
                                </Button>
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
                          {fmtDate(inv.reservation?.reservationDate)} | {fmtTime(inv.reservation?.startTime)} - {fmtTime(inv.reservation?.endTime)}
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

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}