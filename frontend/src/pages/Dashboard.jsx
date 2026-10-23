import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Card, Box, CircularProgress, Alert,
  Button, Chip, Snackbar, Tooltip, Pagination, Divider
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from "next-auth/react";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useTranslation } from 'react-i18next';
import { formatRelativeTime } from '../utils/formatTime';

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
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';

const ANN_PER_PAGE = 3;

function Dashboard() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status } = useSession();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';
  const isEn = currentLang === 'en';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [annFilter, setAnnFilter] = useState('ALL');
  const [annPage, setAnnPage] = useState(1);

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
    const isStudentView = new URLSearchParams(window.location.search).get('studentView') === 'true';
    const userRole = session?.user?.role;
    if (['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
      navigate('/admin', { replace: true });
      return;
    }
    if (userRole === 'LIBRARIAN' && !isStudentView) {
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
        setAnnouncements(annRes.data || []);
        setInvitations(invRes.data || []);
        setActiveReservations(activeRes.data || []);
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

  const filteredAnnouncements = useMemo(() => {
    const sorted = [...announcements].sort(
      (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)
    );
    if (annFilter === 'IMPORTANT') {
      return sorted.filter((a) => ['HIGH', 'URGENT'].includes(a.priority) || a.isPinned);
    }
    if (annFilter === 'NORMAL') {
      return sorted.filter((a) => ['LOW', 'MEDIUM'].includes(a.priority) && !a.isPinned);
    }
    return sorted;
  }, [announcements, annFilter]);

  const paginatedAnnouncements = useMemo(() => {
    const start = (annPage - 1) * ANN_PER_PAGE;
    return filteredAnnouncements.slice(start, start + ANN_PER_PAGE);
  }, [filteredAnnouncements, annPage]);

  if (status === "loading" || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session?.user?.acceptedAgreementVersion) return null;
  if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;

  const noShowCount = session?.user?.noShowCount ?? 0;
  const isBanned = Boolean(session?.user?.isBanned);
  const banUntilStr = session?.user?.banUntil
    ? new Date(session.user.banUntil).toLocaleDateString(isEn ? 'en-US' : 'tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : isEn
    ? 'Permanent (Indefinite)'
    : 'Kalıcı (Süresiz)';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8, overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Container maxWidth="lg" sx={{ pt: { xs: 2.5, md: 4 }, px: { xs: 2, sm: 3 }, flex: 1 }}>

        {isBanned && (
          <Alert
            severity="error"
            icon={<BlockIcon fontSize="inherit" />}
            sx={{
              mb: 3,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: 'error.main',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.12)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              {isEn
                ? `Your Study Room Reservation Access is Suspended (Until: ${banUntilStr})`
                : `Çalışma Odası Rezervasyon Yetkiniz Askıya Alınmıştır (Açılma Tarihi: ${banUntilStr})`}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.5 }}>
              <strong>{isEn ? 'Reason:' : 'Sebep:'}</strong>{' '}
              {session?.user?.banReason ||
                (isEn
                  ? '3/3 No-Show violations during the semester.'
                  : 'Dönem içinde 3/3 No-Show (Rezervasyona Gelmeme) kural ihlali.')}
            </Typography>
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'flex-end' },
            justifyContent: 'space-between',
            gap: 2,
            mb: 4,
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ mb: 0.75, letterSpacing: '-0.02em', fontSize: { xs: '1.6rem', sm: '2.125rem' } }}>
              {t('welcomeBack', { name: session?.user?.name?.split(' ')[0] || 'Öğrenci' })}
            </Typography>
            <Typography variant="subtitle2">
              {t('welcomeSubtitle')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <Tooltip
              title={
                isBanned
                  ? `Hesabınız ${banUntilStr} tarihine kadar rezervasyonlara kapalıdır.`
                  : `Dönem içinde 3 kez No-Show uyarısı alan hesaplar 30 gün boyunca rezervasyonlara kapatılır. Kalan uyarı hakkınız: ${Math.max(0, 3 - noShowCount)}`
              }
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.75,
                  py: 1,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: isBanned
                    ? 'error.main'
                    : noShowCount > 0
                    ? 'warning.main'
                    : alpha(theme.palette.success.main, 0.4),
                  bgcolor: isBanned
                    ? alpha(theme.palette.error.main, 0.1)
                    : noShowCount > 0
                    ? alpha(theme.palette.warning.main, 0.1)
                    : alpha(theme.palette.success.main, 0.08),
                  color: isBanned
                    ? 'error.main'
                    : noShowCount > 0
                    ? 'warning.dark'
                    : 'success.dark',
                }}
              >
                {isBanned ? (
                  <BlockIcon fontSize="small" />
                ) : noShowCount > 0 ? (
                  <WarningAmberIcon fontSize="small" />
                ) : (
                  <VerifiedUserIcon fontSize="small" />
                )}
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', lineHeight: 1.2 }}>
                    {isBanned
                      ? isEn
                        ? `BANNED (${banUntilStr})`
                        : `YASAKLI (${banUntilStr})`
                      : isEn
                      ? `No-Show Warnings: ${noShowCount} / 3`
                      : `No-Show Uyarısı: ${noShowCount} / 3`}
                  </Typography>
                  <Typography sx={{ fontSize: '0.66rem', opacity: 0.9, lineHeight: 1.2 }}>
                    {isBanned
                      ? isEn
                        ? 'Cannot create or join bookings'
                        : 'Randevu oluşturulamaz / katılınamaz'
                      : isEn
                      ? `${Math.max(0, 3 - noShowCount)} rights remaining`
                      : `Kalan Uyarı Hakkı: ${Math.max(0, 3 - noShowCount)}`}
                  </Typography>
                </Box>
              </Box>
            </Tooltip>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'action.hover', color: 'primary.main', px: 2, py: 1.15, borderRadius: 2 }}>
              <InfoIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                {currentLang === 'tr' ? 'Kütüphane 7/24 Açık (00:00 - 24:00)' : 'Library Open 24/7 (00:00 - 24:00)'}
              </Typography>
            </Box>
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
                      onClick={() => !isBanned && navigate('/reserve')}
                      sx={{
                        position: 'relative',
                        bgcolor: isBanned ? 'grey.500' : 'primary.main',
                        color: 'primary.contrastText',
                        p: 2.5,
                        height: '100%',
                        cursor: isBanned ? 'not-allowed' : 'pointer',
                        overflow: 'hidden',
                        border: 'none',
                        transition: 'all 0.3s',
                        '&:hover': !isBanned ? { transform: 'translateY(-2px)' } : {},
                      }}
                    >
                      <EventAvailableIcon className="bg-icon" sx={{ position: 'absolute', top: -16, right: -16, fontSize: 120, opacity: 0.1 }} />
                      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                        <Box>
                          <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', width: 'fit-content', p: 1, borderRadius: 2, mb: 2 }}>
                            <AddCircleIcon fontSize="small" />
                          </Box>
                          <Typography variant="h6" sx={{ mb: 0.5, fontSize: '1.125rem', color: 'primary.contrastText' }}>{t('reserveRoom')}</Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 3 }}>
                            {isBanned
                              ? isEn
                                ? `Suspended until ${banUntilStr}`
                                : `${banUntilStr} tarihine kadar kapalı`
                              : t('reserveRoomDesc')}
                          </Typography>
                        </Box>
                        <Button
                          fullWidth
                          variant="contained"
                          disabled={isBanned}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isBanned) navigate('/reserve');
                          }}
                          sx={{ bgcolor: 'background.paper', color: 'primary.main', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          {isBanned ? (isEn ? 'Suspended' : 'Hesap Askıda') : t('bookNow')}
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
                        {currentLang === 'tr' ? 'Aktif randevularınızı görüntüleyin, davetleri yanıtlayın veya erken boşaltın.' : 'View active bookings, respond to invitations, or check out early.'}
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
                      const roomLabel = res.room?.name ? `${res.room.roomNumber} - ${res.room.name}` : `Oda ${res.room?.roomNumber}`;
                      const creatorName = res.user?.fullName || res.user?.email;

                      return (
                        <Card key={inv.id} sx={{ borderLeft: `4px solid ${theme.palette.warning.main}`, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
                              {t('invitedYouTo', { name: creatorName, room: roomLabel })}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                <ScheduleIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">{t('inviteDate', { date: dateStr, start: startStr, end: endStr })}</Typography>
                              </Box>
                              {res.purpose && (
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>• {res.purpose}</Typography>
                              )}
                            </Box>
                          </Box>
                          <Divider />
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              disabled={respondingId === inv.id || isBanned}
                              startIcon={<CheckCircleOutlineIcon fontSize="small" />}
                              onClick={() => handleInvitationRespond(inv.id, 'ACCEPT')}
                            >
                              {t('accept')}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={respondingId === inv.id}
                              startIcon={<HighlightOffIcon fontSize="small" />}
                              onClick={() => handleInvitationRespond(inv.id, 'REJECT')}
                            >
                              {t('reject')}
                            </Button>
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
                        <Card key={res.id} sx={{ borderLeft: `4px solid ${theme.palette[statusColor].main}` }}>
                          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', p: 2, gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                              <Box sx={{ minWidth: 56, bgcolor: isConfirmedOrCheckedIn ? alpha(theme.palette.success.main, 0.08) : 'action.hover', color: isConfirmedOrCheckedIn ? 'success.main' : 'primary.main', p: 1, borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{monthStr}</Typography>
                                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.2 }}>{dayStr}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="body1" sx={{ fontWeight: 700 }}>{roomLabel}</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5, flexWrap: 'wrap' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                    <ScheduleIcon sx={{ fontSize: 16 }} />
                                    <Typography variant="body2">{fmtTime(res.startTime)} - {fmtTime(res.endTime)}</Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                    <GroupIcon sx={{ fontSize: 16 }} />
                                    <Typography variant="body2">{t('participantsCount', { count: totalPeople })}</Typography>
                                  </Box>
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
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <Button size="small" variant="outlined" fullWidth onClick={() => navigate('/bookings')}>
                                {isEn ? 'Manage' : 'Yönet'}
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

          {/* Sağ Sütun: Yalnızca Kategorili & 3'erli Sayfalı Duyurular */}
          <Box sx={{
            width: { xs: '100%', md: 350 },
            flexShrink: 0,
            position: { md: 'sticky' },
            top: { md: 80 },
            alignSelf: { md: 'flex-start' },
          }}>
            <Card sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CampaignIcon color="warning" />
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 800 }}>
                    {t('announcements')}
                  </Typography>
                </Box>
                <Chip
                  label={`${filteredAnnouncements.length}`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 0.75, mb: 2, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
                <Chip
                  label={isEn ? 'All (Latest)' : 'Tümü (En Yeni)'}
                  size="small"
                  color={annFilter === 'ALL' ? 'primary' : 'default'}
                  onClick={() => { setAnnFilter('ALL'); setAnnPage(1); }}
                  sx={{ fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}
                />
                <Chip
                  label={isEn ? 'Urgent / High' : 'Acil & Önemli'}
                  size="small"
                  color={annFilter === 'IMPORTANT' ? 'error' : 'default'}
                  onClick={() => { setAnnFilter('IMPORTANT'); setAnnPage(1); }}
                  sx={{ fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}
                />
                <Chip
                  label={isEn ? 'General Info' : 'Bilgi / Normal'}
                  size="small"
                  color={annFilter === 'NORMAL' ? 'info' : 'default'}
                  onClick={() => { setAnnFilter('NORMAL'); setAnnPage(1); }}
                  sx={{ fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}
                />
              </Box>

              {paginatedAnnouncements.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                  {t('noAnnouncements')}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {paginatedAnnouncements.map((ann) => {
                    const isUrgent = ann.priority === 'HIGH' || ann.priority === 'URGENT';
                    const badgeColor = isUrgent ? 'error' : ann.priority === 'MEDIUM' ? 'primary' : 'default';
                    const badgeLabel =
                      ann.priority === 'URGENT'
                        ? isEn ? 'URGENT' : 'ACİL'
                        : ann.priority === 'HIGH'
                        ? isEn ? 'IMPORTANT' : 'ÖNEMLİ'
                        : isEn ? 'INFO' : 'BİLGİ';

                    const title = ann.title?.[currentLang] || ann.title?.tr || ann.title;
                    const content = ann.content?.[currentLang] || ann.content?.tr || ann.content;

                    return (
                      <Box
                        key={ann.id}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: isUrgent ? alpha(theme.palette.error.main, 0.04) : 'action.hover',
                          borderLeft: `3px solid ${isUrgent ? theme.palette.error.main : theme.palette.primary.main}`,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
                          <Chip
                            label={badgeLabel}
                            size="small"
                            color={badgeColor}
                            sx={{ height: 18, fontSize: '0.62rem', fontWeight: 800 }}
                          />
                          {ann.publishedAt && (
                            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600 }}>
                              {formatRelativeTime(ann.publishedAt, currentLang)}
                            </Typography>
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5, mt: 0.5 }}>
                          {title}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontSize: '0.75rem', lineHeight: 1.55 }}>
                          {content}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}

              {filteredAnnouncements.length > ANN_PER_PAGE && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Pagination
                    size="small"
                    count={Math.ceil(filteredAnnouncements.length / ANN_PER_PAGE)}
                    page={annPage}
                    onChange={(_, p) => setAnnPage(p)}
                    color="primary"
                  />
                </Box>
              )}
            </Card>
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