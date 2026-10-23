import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Card, Box, CircularProgress, Alert,
  IconButton, Button, Chip, Snackbar, Tooltip
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from "next-auth/react";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../utils/formatTime';
import RoomDensityChart from '../components/dashboard/RoomDensityChart';

import BoltIcon from '@mui/icons-material/Bolt';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GavelIcon from '@mui/icons-material/Gavel';
import GroupIcon from '@mui/icons-material/Group';
import UpcomingIcon from '@mui/icons-material/Upcoming';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CampaignIcon from '@mui/icons-material/Campaign';
import InfoIcon from '@mui/icons-material/Info';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import PersonIcon from '@mui/icons-material/Person';

function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status } = useSession();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [activeReservations, setActiveReservations] = useState([]);
  const [respondingId, setRespondingId] = useState(null);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      navigate('/');
      return;
    }
    if (session?.user && !session.user.acceptedAgreementVersion) {
      navigate('/rules');
      return;
    }
    if (['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role)) {
      navigate('/admin', { replace: true });
    }
  }, [session, status, navigate]);

  const fetchInvitations = useCallback(() => {
    return api.get('/invitations').then(r => setInvitations(r.data)).catch(() => {});
  }, []);

  const fetchActiveReservations = useCallback(() => {
    return api.get('/reservations/active').then(r => setActiveReservations(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "loading" || !session?.user?.acceptedAgreementVersion) return;

    Promise.all([
      api.get('/announcements').catch(() => ({ data: [] })),
      api.get('/invitations').catch(() => ({ data: [] })),
      api.get('/reservations/active').catch(() => ({ data: [] })),
    ])
      .then(([annRes, invRes, activeRes]) => {
        setAnnouncements(annRes.data);
        setInvitations(invRes.data);
        setActiveReservations(activeRes.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Veri çekme hatası:", err);
        setError("Veriler yüklenirken bir hata oluştu.");
        setLoading(false);
      });
  }, [status, session]);

  const handleInvitationRespond = async (participantId, action) => {
    setRespondingId(participantId);
    try {
      await api.post('/invitations/respond', { participantId, action });
      setSnack({
        open: true,
        message: action === 'ACCEPT' ? t('inviteAccepted') : t('inviteRejected'),
        severity: action === 'ACCEPT' ? 'success' : 'info',
      });
      await Promise.all([fetchInvitations(), fetchActiveReservations()]);
    } catch (err) {
      setSnack({
        open: true,
        message: err.response?.data?.error || 'Bir hata oluştu.',
        severity: 'error',
      });
    } finally {
      setRespondingId(null);
    }
  };

  const fmtDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  };

  const fmtTime = (timeStr) => {
    const d = new Date(timeStr);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (h === 23 && m >= 59) return '24:00';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  if (status === "loading" || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session?.user?.acceptedAgreementVersion) return null;
  if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8, overflowX: 'hidden' }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ pt: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'flex-end' }, justifyContent: 'space-between', gap: 2, mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ mb: 1, letterSpacing: '-0.02em' }}>
              {t('welcomeBack', { name: session?.user?.name?.split(' ')[0] || 'Öğrenci' })}
            </Typography>
            <Typography variant="subtitle2">
              {t('welcomeSubtitle')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', color: 'primary.main', px: 2, py: 1, borderRadius: 2 }}>
            <InfoIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {currentLang === 'tr' ? 'Kütüphane 7/24 Açık (00:00 - 24:00)' : 'Library Open 24/7 (00:00 - 24:00)'}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          <Box sx={{ flex: { md: 1 }, minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Box>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BoltIcon color="primary" /> {t('quickActions')}
                </Typography>

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                  <Box>
                    <Card
                      onClick={() => navigate('/reserve')}
                      sx={{
                        position: 'relative', bgcolor: 'primary.main', color: 'primary.contrastText', p: 2.5, height: '100%',
                        cursor: 'pointer', overflow: 'hidden', border: 'none',
                        transition: 'all 0.3s', '&:hover': { transform: 'translateY(-2px)' }, '&:hover .bg-icon': { transform: 'scale(1.1)' }
                      }}
                    >
                      <EventAvailableIcon className="bg-icon" sx={{ position: 'absolute', top: -16, right: -16, fontSize: 120, opacity: 0.1, transition: 'transform 0.5s' }} />
                      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                        <Box>
                          <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', width: 'fit-content', p: 1, borderRadius: 2, mb: 2 }}>
                            <AddCircleIcon fontSize="small" />
                          </Box>
                          <Typography variant="h6" sx={{ mb: 0.5, fontSize: '1.125rem', color: 'primary.contrastText' }}>{t('reserveRoom')}</Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 3 }}>{t('reserveRoomDesc')}</Typography>
                        </Box>
                        <Button fullWidth variant="contained" onClick={(e) => { e.stopPropagation(); navigate('/reserve'); }} sx={{ bgcolor: 'background.paper', color: 'primary.main', '&:hover': { bgcolor: 'action.hover' } }}>
                          {t('bookNow')}
                        </Button>
                      </Box>
                    </Card>
                  </Box>

                  <Box>
                    <Card
                      onClick={() => navigate('/bookings')}
                      sx={{ p: 2.5, height: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'all 0.2s', '&:hover .icon-box': { bgcolor: 'action.hover', color: 'primary.main' } }}
                    >
                      <Box className="icon-box" sx={{ bgcolor: 'background.default', color: 'text.secondary', width: 'fit-content', p: 1, borderRadius: 2, mb: 2, transition: 'all 0.2s' }}>
                        <EventNoteIcon />
                      </Box>
                      <Typography variant="h6" sx={{ fontSize: '1.125rem' }}>{t('navMyBookings')}</Typography>
                      <Typography variant="subtitle2" sx={{ fontSize: '0.875rem' }}>
                        {currentLang === 'tr' ? 'Aktif randevularınızı görüntüleyin, gruba üye ekleyin veya erken boşaltın.' : 'View active bookings, manage group members, or check out early.'}
                      </Typography>
                    </Card>
                  </Box>

                  <Box>
                    <Card
                      onClick={() => navigate('/rules?view=true')}
                      sx={{ p: 2.5, height: '100%', cursor: 'pointer', display: 'flex', flexDirection: 'column', transition: 'all 0.2s', '&:hover .icon-box': { bgcolor: 'action.hover', color: 'primary.main' } }}
                    >
                      <Box className="icon-box" sx={{ bgcolor: 'background.default', color: 'text.secondary', width: 'fit-content', p: 1, borderRadius: 2, mb: 2, transition: 'all 0.2s' }}>
                        <GavelIcon />
                      </Box>
                      <Typography variant="h6" sx={{ fontSize: '1.125rem' }}>{t('reservationRules')}</Typography>
                      <Typography variant="subtitle2" sx={{ fontSize: '0.875rem' }}>{t('reservationRulesDesc')}</Typography>
                    </Card>
                  </Box>
                </Box>
              </Box>

              {invitations.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MailOutlineIcon color="warning" /> {t('pendingInvitations')} (30 Dk Onay Süresi)
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {invitations.map((inv) => {
                      const res = inv.reservation;
                      const dateStr = fmtDate(res.reservationDate);
                      const startStr = fmtTime(res.startTime);
                      const endStr = fmtTime(res.endTime);
                      const roomLabel = res.room?.name || `Oda ${res.room?.roomNumber}`;
                      const creatorName = res.user?.fullName || res.user?.email;

                      return (
                        <Card key={inv.id} sx={{ borderLeft: `4px solid ${theme.palette.warning.main}`, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 12px -2px rgba(0,0,0,0.08)' } }}>
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', p: 2, gap: 1.5 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {t('invitedYouTo', { name: creatorName, room: roomLabel })}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                  <ScheduleIcon sx={{ fontSize: 16 }} />
                                  <Typography variant="body2">{t('inviteDate', { date: dateStr, start: startStr, end: endStr })}</Typography>
                                </Box>
                                {res.purpose && (
                                  <>
                                    <Box sx={{ display: { xs: 'none', sm: 'block' }, width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{res.purpose}</Typography>
                                  </>
                                )}
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                              <Tooltip title={t('accept')}>
                                <IconButton
                                  size="small"
                                  disabled={respondingId === inv.id}
                                  onClick={() => handleInvitationRespond(inv.id, 'ACCEPT')}
                                  sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.2) } }}
                                >
                                  <CheckCircleOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('reject')}>
                                <IconButton
                                  size="small"
                                  disabled={respondingId === inv.id}
                                  onClick={() => handleInvitationRespond(inv.id, 'REJECT')}
                                  sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}
                                >
                                  <HighlightOffIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Card>
                      );
                    })}
                  </Box>
                </Box>
              )}

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <UpcomingIcon color="primary" /> {t('myActiveReservations')}
                  </Typography>
                </Box>

                {activeReservations.length === 0 ? (
                  <Card sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('noActiveReservations')}</Typography>
                  </Card>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {activeReservations.map((res) => {
                      const isCreator = res.user?.id === session?.user?.id || res.user?.email === session?.user?.email;
                      const isConfirmedOrCheckedIn = res.status === 'CONFIRMED' || res.status === 'CHECKED_IN';
                      const statusColor = isConfirmedOrCheckedIn ? 'success' : 'warning';
                      const statusLabel =
                        res.status === 'CHECKED_IN'
                          ? t('happeningNow')
                          : res.status === 'CONFIRMED'
                          ? t('confirmed')
                          : t('pendingApproval');

                      const d = new Date(res.reservationDate);
                      const monthStr = d.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
                      const dayStr = d.getUTCDate();
                      const roomLabel = res.room?.name ? `${res.room.roomNumber} - ${res.room.name}` : `Room ${res.room?.roomNumber}`;
                      const acceptedCount = (res.participants || []).filter(p => p.status === 'ACCEPTED').length;
                      const totalPeople = 1 + acceptedCount;

                      return (
                        <Card key={res.id} sx={{ borderLeft: `4px solid ${theme.palette[statusColor].main}`, transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' } }}>
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                              <Box sx={{ minWidth: 56, bgcolor: isConfirmedOrCheckedIn ? alpha(theme.palette.success.main, 0.08) : 'action.hover', color: isConfirmedOrCheckedIn ? 'success.main' : 'primary.main', p: 1, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{monthStr}</Typography>
                                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.2 }}>{dayStr}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 700 }}>{roomLabel}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                    <ScheduleIcon sx={{ fontSize: 16 }} />
                                    <Typography variant="body2">{fmtTime(res.startTime)} - {fmtTime(res.endTime)}</Typography>
                                  </Box>
                                  <Box sx={{ display: { xs: 'none', sm: 'block' }, width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                    <GroupIcon sx={{ fontSize: 16 }} />
                                    <Typography variant="body2">{t('participantsCount', { count: totalPeople })} / 8</Typography>
                                  </Box>
                                  <Box sx={{ display: { xs: 'none', sm: 'block' }, width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.disabled' }} />
                                  <Chip label={statusLabel} size="small" sx={{ bgcolor: alpha(theme.palette[statusColor].main, 0.12), color: `${statusColor}.main`, fontWeight: 600, borderRadius: 1, height: 22 }} />
                                  <Chip
                                    icon={<PersonIcon sx={{ fontSize: '14px !important' }} />}
                                    label={isCreator ? t('youCreated') : t('youJoined')}
                                    size="small"
                                    variant="outlined"
                                    sx={{ borderRadius: 1, height: 22, fontSize: '0.7rem', borderColor: 'divider', color: 'text.secondary' }}
                                  />
                                </Box>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: { xs: 2, sm: 0 } }}>
                              <Button size="small" variant="outlined" onClick={() => navigate('/bookings')}>
                                Yönet
                              </Button>
                            </Box>
                          </Box>
                        </Card>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{
            width: { xs: '100%', md: 320 },
            flexShrink: 0,
            position: { md: 'sticky' },
            top: { md: 80 },
            alignSelf: { md: 'flex-start' },
          }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Card sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <CampaignIcon color="warning" />
                  <Typography variant="h6" sx={{ fontSize: '1rem' }}>{t('announcements')}</Typography>
                </Box>

                {announcements.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                    {t('noAnnouncements')}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {announcements.map((ann) => {
                      const dotColor = ann.priority === 'HIGH' || ann.priority === 'URGENT'
                        ? 'error.main'
                        : ann.priority === 'MEDIUM'
                        ? 'primary.main'
                        : 'text.secondary';

                      const title = ann.title?.[currentLang] || ann.title?.tr || ann.title;
                      const content = ann.content?.[currentLang] || ann.content?.tr || ann.content;

                      return (
                        <Box key={ann.id} sx={{ display: 'flex', gap: 1.5 }}>
                          <Box sx={{ minWidth: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, mt: 0.75 }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
                            <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>{content}</Typography>
                            {ann.publishedAt && (
                              <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled', mt: 1, display: 'block' }}>
                                {formatRelativeTime(ann.publishedAt, currentLang)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Card>

              <RoomDensityChart />
            </Box>
          </Box>
        </Box>
      </Container>

      <Footer />

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Dashboard;