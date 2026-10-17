import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Container, Card, TextField, Button, Chip,
  CircularProgress, Alert, Snackbar, Avatar, IconButton,
  LinearProgress
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import api from '../api';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';

const HOUR_START = 8;
const HOUR_END = 22;
const SLOT_HEIGHT = 56;

const toDateStr = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function ReserveForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const { data: session, status: authStatus } = useSession();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';

  const [step, setStep] = useState(1);
  const [room, setRoom] = useState(null);
  const [rules, setRules] = useState({ minParticipants: 2, maxParticipants: 7 });
  const [initLoading, setInitLoading] = useState(true);

  const today = toDateStr(new Date());
  const initialDate = searchParams.get('date') || today;
  const roomIdParam = searchParams.get('roomId') || '';

  const [formData, setFormData] = useState({
    roomId: roomIdParam,
    date: initialDate,
    startTime: null,
    endTime: null,
    purpose: '',
    participants: [],
  });

  const [occupiedSlots, setOccupiedSlots] = useState([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [missingEmails, setMissingEmails] = useState([]);
  const [snackOpen, setSnackOpen] = useState(false);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') { navigate('/'); return; }
    if (session?.user && !session.user.acceptedAgreementVersion) { navigate('/rules'); return; }
    if (!roomIdParam) { navigate('/reserve'); return; }

    api.get('/reserve/init')
      .then((res) => {
        const foundRoom = res.data.rooms.find(r => r.id === roomIdParam);
        setRoom(foundRoom || null);
        setRules(res.data.rules);
        setInitLoading(false);
      })
      .catch(() => setInitLoading(false));
  }, [authStatus, session, navigate, roomIdParam]);

  const updateForm = (fields) => setFormData((prev) => ({ ...prev, ...fields }));

  // ============ Availability ============
  const fetchAvailability = useCallback(async (roomId, date) => {
    if (!roomId || !date) return;
    setAvailLoading(true);
    try {
      const res = await api.get(`/rooms/${roomId}/availability?date=${date}`);
      setOccupiedSlots(res.data.occupiedSlots || []);
    } catch {
      setOccupiedSlots([]);
    } finally {
      setAvailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initLoading && formData.roomId && formData.date) {
      fetchAvailability(formData.roomId, formData.date);
    }
  }, [formData.roomId, formData.date, initLoading, fetchAvailability]);

  // ============ Week days (today + next 6 days) ============
  const weekDays = useMemo(() => {
    const base = new Date(today + 'T12:00:00');
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(base);
      day.setDate(base.getDate() + i);
      return day;
    });
  }, [today]);

  const maxSelectableDate = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const advanceDays = currentHour > (rules.dailyReleaseHour ?? 8)
      ? (rules.maxAdvanceDays ?? 3)
      : (rules.maxAdvanceDays ?? 3) - 1;
    const max = new Date(today + 'T12:00:00');
    max.setDate(max.getDate() + advanceDays);
    return toDateStr(max);
  }, [rules, today]);

  const fmtWeekday = (d) =>
    d.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'short' }).toUpperCase();

  const fmtLongDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  // ============ Occupied slots ============
  const occupiedBlocks = useMemo(
    () => occupiedSlots.map((s) => ({
      startHour: new Date(s.startTime).getUTCHours(),
      endHour: new Date(s.endTime).getUTCHours(),
    })),
    [occupiedSlots]
  );

  const isSlotOccupied = useCallback((hour) => {
    return occupiedBlocks.some((b) => hour >= b.startHour && hour < b.endHour);
  }, [occupiedBlocks]);

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }, []);
  const isToday = formData.date === today;
  const isSlotPast = useCallback((hour) => isToday && (hour + 1) * 60 <= nowMinutes, [isToday, nowMinutes]);

  // ============ Time selection ============
  const { startTime: selectedStart, endTime: selectedEnd } = formData;
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const hasSelection = selectedStart !== null && selectedEnd !== null;
  const selectionDuration = hasSelection ? selectedEnd - selectedStart : 0;

  const maxDuration = rules.maxDurationHours ?? 3;

  const handleSlotClick = (hour) => {
    if (isSlotOccupied(hour) || isSlotPast(hour)) return;

    if (formData.startTime === null || formData.endTime !== null) {
      updateForm({ startTime: hour, endTime: null });
      return;
    }

    if (hour < formData.startTime) {
      updateForm({ startTime: hour, endTime: null });
      return;
    }

    const potentialEndHour = hour + 1;
    if (potentialEndHour - formData.startTime > maxDuration) return;

    for (let h = formData.startTime; h < potentialEndHour; h++) {
      if (isSlotOccupied(h)) return;
    }

    updateForm({ endTime: potentialEndHour });
  };

  // ============ Participants ============
  const totalPeople = formData.participants.length + 1;
  const maxCapacity = room?.capacity || rules.maxParticipants;
  const effectiveMax = Math.min(rules.maxParticipants, maxCapacity);
  const isCountValid = totalPeople >= rules.minParticipants && totalPeople <= effectiveMax;

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    if (email === session?.user?.email?.toLowerCase()) return;
    if (formData.participants.includes(email)) return;
    if (totalPeople >= effectiveMax) return;
    updateForm({ participants: [...formData.participants, email] });
    setEmailInput('');
  };

  const removeEmail = (email) => {
    updateForm({ participants: formData.participants.filter((e) => e !== email) });
  };

  // ============ Submit ============
  const handleSubmit = async () => {
    setApiError(null);
    setMissingEmails([]);
    setSubmitting(true);
    try {
      await api.post('/reservations', {
        roomId: formData.roomId,
        reservationDate: formData.date,
        startTime: `${String(formData.startTime).padStart(2, '0')}:00`,
        endTime: `${String(formData.endTime).padStart(2, '0')}:00`,
        purpose: formData.purpose,
        participantEmails: formData.participants,
      });
      setSnackOpen(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409) setApiError(t('rfOverlap'));
      else if (data?.missingEmails) { setMissingEmails(data.missingEmails); setApiError(t('rfMissingEmails')); }
      else setApiError(data?.error || 'Bir hata oluştu.');
      setSubmitting(false);
    }
  };

  // ============ Loading ============
  if (authStatus === 'loading' || initLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}><CircularProgress /></Box>;
  }
  if (!room) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Navbar />
        <Container sx={{ pt: 4 }}><Alert severity="error">Room not found</Alert></Container>
      </Box>
    );
  }

  const stripedBg = `repeating-linear-gradient(45deg, ${alpha('#e5e7eb', 0.4)}, ${alpha('#e5e7eb', 0.4)} 10px, ${alpha('#f3f4f6', 0.4)} 10px, ${alpha('#f3f4f6', 0.4)} 20px)`;

  // ======================= RENDER =======================
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      {/* ============================================================= */}
      {/*  STEP 1 — TIME SELECTION (Calendar & Time Picker)             */}
      {/* ============================================================= */}
      {step === 1 && (
        <>
          {/* ---- Room Info Bar ---- */}
          <Box sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', py: 2 }}>
            <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 3, lg: 5 }, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                    Room {room.roomNumber} - {room.name}
                  </Typography>
                  <Chip
                    label={t('rfAvailable').toUpperCase()}
                    size="small"
                    sx={{ bgcolor: alpha('#16a34a', 0.1), color: '#16a34a', fontWeight: 700, fontSize: '0.6rem', height: 22, letterSpacing: '0.04em' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, color: 'text.secondary', mt: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <GroupIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{t('rfCapacity', { count: room.capacity })}</Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1.5,
                bgcolor: alpha('#3b82f6', 0.05), border: '1px solid', borderColor: alpha('#3b82f6', 0.12),
                px: 2, py: 1.5, borderRadius: 2, maxWidth: { sm: 340 }, flexShrink: 0,
              }}>
                <Box sx={{ p: 0.5, bgcolor: alpha('#3b82f6', 0.1), borderRadius: 1, color: 'primary.main', display: 'flex', flexShrink: 0 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: t('rfReservationPolicy', { hours: maxDuration }) }}
                />
              </Box>
            </Box>
          </Box>

          {/* ---- Main Content ---- */}
          <Box sx={{ flex: 1, maxWidth: 1400, mx: 'auto', width: '100%', px: { xs: 3, lg: 5 }, pb: 16, pt: 3 }}>
            {/* Breadcrumbs */}
            <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
              {[
                { label: t('navDashboard'), onClick: () => navigate('/dashboard') },
                { label: t('navStudyRooms'), onClick: () => navigate('/reserve') },
                { label: `Room ${room.roomNumber}` },
              ].map((crumb, idx, arr) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1 }}>
                  {idx > 0 && <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 500 }}>/</Typography>}
                  <Typography
                    onClick={crumb.onClick}
                    sx={{
                      fontSize: '0.8rem', fontWeight: 500,
                      color: idx === arr.length - 1 ? 'text.primary' : 'text.secondary',
                      cursor: crumb.onClick ? 'pointer' : 'default',
                      '&:hover': crumb.onClick ? { color: 'primary.main' } : {},
                    }}
                  >
                    {crumb.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Calendar Layout */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, minHeight: { md: 'calc(100vh - 280px)' } }}>

              {/* ---- Week Sidebar ---- */}
              <Card sx={{
                width: { xs: '100%', md: 200, lg: 220 }, flexShrink: 0,
                display: 'flex', flexDirection: { xs: 'row', md: 'column' },
                overflow: 'auto', p: 1,
              }}>
                {weekDays.map((d) => {
                  const ds = toDateStr(d);
                  const isActive = ds === formData.date;
                  const isPastDay = ds < today;
                  const isBeyondMax = ds > maxSelectableDate;
                  const isDisabled = isPastDay || isBeyondMax;
                  return (
                    <Box
                      key={ds}
                      onClick={() => !isDisabled && updateForm({ date: ds, startTime: null, endTime: null })}
                      sx={{
                        flex: { xs: 'none', md: 1 },
                        display: 'flex', flexDirection: { xs: 'row', md: 'column' },
                        alignItems: 'center', justifyContent: 'center',
                        gap: { xs: 1, md: 0.5 }, p: 1.5, borderRadius: 2,
                        minWidth: { xs: 56, md: 'auto' },
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        bgcolor: isActive ? 'primary.main' : 'transparent',
                        color: isActive ? '#fff' : isDisabled ? 'text.disabled' : 'text.primary',
                        boxShadow: isActive ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}` : 'none',
                        transition: 'all 0.15s',
                        opacity: isDisabled && !isActive ? 0.5 : 1,
                        '&:hover': !isActive && !isDisabled ? { bgcolor: 'action.hover' } : {},
                      }}
                    >
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: isActive ? 700 : 500, textTransform: 'uppercase' }}>
                        {fmtWeekday(d)}
                      </Typography>
                      <Typography sx={{ fontSize: '1.05rem', fontWeight: 700 }}>{d.getDate()}</Typography>
                    </Box>
                  );
                })}
              </Card>

              {/* ---- Time Grid Card ---- */}
              <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Legend */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', overflow: 'auto', flexShrink: 0 }}>
                  {[
                    { color: '#fff', border: theme.palette.grey[300], label: t('rfAvailable') },
                    { color: theme.palette.primary.main, border: theme.palette.primary.main, label: t('rfSelected') },
                    { color: theme.palette.grey[200], border: theme.palette.grey[300], striped: true, label: t('rfReserved') },
                    { color: theme.palette.grey[100], border: theme.palette.grey[200], label: t('rfPast') },
                  ].map((item) => (
                    <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap' }}>
                      <Box sx={{
                        width: 12, height: 12, borderRadius: '50%',
                        bgcolor: item.color, border: `1px solid ${item.border}`,
                        ...(item.striped && { backgroundImage: stripedBg }),
                      }} />
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'text.secondary' }}>{item.label}</Typography>
                    </Box>
                  ))}
                </Box>

                {/* Scrollable Grid */}
                <Box sx={{ display: 'flex', flex: 1, overflow: 'auto' }}>
                  {/* Hour labels column */}
                  <Box sx={{
                    width: { xs: 56, sm: 68 }, flexShrink: 0,
                    borderRight: '1px solid', borderColor: 'divider',
                    bgcolor: alpha(theme.palette.grey[50], 0.6),
                    position: 'sticky', left: 0, zIndex: 10,
                  }}>
                    {hours.map((h) => (
                      <Box key={h} sx={{ height: SLOT_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pt: 1, borderBottom: '1px solid', borderColor: alpha(theme.palette.divider, 0.5) }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'text.disabled' }}>
                          {String(h).padStart(2, '0')}:00
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Slot area */}
                  <Box sx={{ flex: 1, position: 'relative' }}>
                    {availLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: SLOT_HEIGHT * hours.length }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <>
                        {/* Dashed grid lines */}
                        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                          {hours.map((h) => (
                            <Box key={h} sx={{ height: SLOT_HEIGHT, borderBottom: '1px dashed', borderColor: alpha(theme.palette.divider, 0.4) }} />
                          ))}
                        </Box>

                        {/* Occupied blocks (absolute overlay) */}
                        {occupiedBlocks.map((block, i) => (
                          <Box
                            key={`occ-${i}`}
                            sx={{
                              position: 'absolute',
                              top: (block.startHour - HOUR_START) * SLOT_HEIGHT + 4,
                              left: 4, right: 4,
                              height: (block.endHour - block.startHour) * SLOT_HEIGHT - 8,
                              borderRadius: 1,
                              bgcolor: 'grey.200',
                              backgroundImage: stripedBg,
                              border: '1px solid', borderColor: 'grey.300',
                              zIndex: 10, pointerEvents: 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              '&:hover .occ-label': { opacity: 1 },
                            }}
                          >
                            <Typography className="occ-label" sx={{
                              fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled',
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                              opacity: 0.6,
                            }}>
                              {t('rfReserved')}
                            </Typography>
                          </Box>
                        ))}

                        {/* Start-only marker (first click, waiting for end) */}
                        {selectedStart !== null && selectedEnd === null && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: (selectedStart - HOUR_START) * SLOT_HEIGHT,
                              left: 0, right: 0,
                              height: SLOT_HEIGHT,
                              p: '4px',
                              zIndex: 20, pointerEvents: 'none',
                            }}
                          >
                            <Box sx={{
                              width: '100%', height: '100%',
                              bgcolor: alpha(theme.palette.primary.main, 0.15),
                              borderRadius: 1,
                              border: `2px dashed ${theme.palette.primary.main}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'primary.main' }}>
                                {String(selectedStart).padStart(2, '0')}:00 — {t('rfSelectEnd')}
                              </Typography>
                            </Box>
                          </Box>
                        )}

                        {/* Selected block (absolute overlay) */}
                        {hasSelection && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: (selectedStart - HOUR_START) * SLOT_HEIGHT,
                              left: 0, right: 0,
                              height: selectionDuration * SLOT_HEIGHT,
                              p: '4px',
                              zIndex: 20, pointerEvents: 'none',
                            }}
                          >
                            <Box sx={{
                              width: '100%', height: '100%',
                              bgcolor: 'primary.main',
                              borderRadius: 1,
                              boxShadow: `0 4px 15px ${alpha(theme.palette.primary.main, 0.3)}`,
                              border: `1px solid ${theme.palette.primary.dark}`,
                              display: 'flex', flexDirection: 'column', p: 2,
                              position: 'relative', cursor: 'pointer',
                            }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                                  {t('rfYourSelection')}
                                </Typography>
                              </Box>
                              <Typography sx={{ fontSize: '0.75rem', color: alpha('#fff', 0.8), mt: 0.5 }}>
                                {String(selectedStart).padStart(2, '0')}:00 - {String(selectedEnd).padStart(2, '0')}:00
                              </Typography>
                              <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ScheduleIcon sx={{ fontSize: 14, color: '#fff' }} />
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                                  {selectionDuration}h 00m
                                </Typography>
                              </Box>
                              <Box sx={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 32, height: 4, bgcolor: alpha('#fff', 0.3), borderRadius: 2 }} />
                            </Box>
                          </Box>
                        )}

                        {/* Clickable rows (main layer) */}
                        <Box sx={{ position: 'relative', zIndex: 5 }}>
                          {hours.map((hour) => {
                            const occupied = isSlotOccupied(hour);
                            const past = isSlotPast(hour);
                            const disabled = occupied || past;
                            return (
                              <Box
                                key={hour}
                                onClick={() => !disabled && handleSlotClick(hour)}
                                sx={{
                                  height: SLOT_HEIGHT,
                                  cursor: disabled ? 'not-allowed' : 'pointer',
                                  borderBottom: '1px solid transparent',
                                  '&:hover': !disabled ? { bgcolor: alpha(theme.palette.primary.main, 0.03) } : {},
                                }}
                              />
                            );
                          })}
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </Card>
            </Box>
          </Box>

          {/* ---- Fixed Bottom Bar ---- */}
          <Box sx={{
            position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 50,
            bgcolor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid', borderColor: 'divider',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.08)',
          }}>
            <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 3, lg: 5 }, py: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: { xs: '100%', md: 'auto' } }}>
                <Box sx={{
                  display: { xs: 'none', sm: 'flex' },
                  width: 48, height: 48, borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  alignItems: 'center', justifyContent: 'center', color: 'primary.main', flexShrink: 0,
                }}>
                  <EventAvailableIcon sx={{ fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {t('rfSelectedReservation')}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 700 }}>{fmtLongDate(formData.date)}</Typography>
                    {hasSelection && (
                      <>
                        <Typography sx={{ color: 'divider', fontSize: '0.85rem' }}>|</Typography>
                        <Typography sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                          {String(selectedStart).padStart(2, '0')}:00 - {String(selectedEnd).padStart(2, '0')}:00
                        </Typography>
                        <Chip
                          label={`${selectionDuration}h 00m`}
                          size="small"
                          sx={{
                            ml: 0.5, height: 22,
                            bgcolor: alpha('#16a34a', 0.1), color: '#16a34a',
                            fontWeight: 700, fontSize: '0.7rem',
                            border: '1px solid', borderColor: alpha('#16a34a', 0.2),
                          }}
                        />
                      </>
                    )}
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', md: 'auto' } }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/reserve')}
                  sx={{
                    flex: { xs: 1, md: 'none' }, px: 3, py: 1.25, borderRadius: 2,
                    borderColor: 'grey.300', color: 'text.primary', fontWeight: 500,
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'grey.400' },
                  }}
                >
                  {t('rfBackToRooms')}
                </Button>
                <Button
                  variant="contained"
                  disabled={!hasSelection}
                  onClick={() => setStep(2)}
                  endIcon={<CheckCircleIcon sx={{ fontSize: '20px !important' }} />}
                  sx={{
                    flex: { xs: 1, md: 'none' }, px: 4, py: 1.25, borderRadius: 2,
                    fontWeight: 600,
                    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.25)}`,
                    '&:hover': { boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}` },
                    transition: 'all 0.2s',
                    '&:active': { transform: 'scale(0.97)' },
                  }}
                >
                  {t('rfContinue')}
                </Button>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {/* ============================================================= */}
      {/*  STEP 2 — PARTICIPANTS                                        */}
      {/* ============================================================= */}
      {step === 2 && (
        <Box sx={{ flex: 1, maxWidth: 960, mx: 'auto', width: '100%', px: { xs: 2, md: 4 }, py: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* Back link */}
          <Button
            startIcon={<ArrowBackIcon sx={{ fontSize: '18px !important' }} />}
            onClick={() => setStep(1)}
            sx={{ alignSelf: 'flex-start', color: 'text.secondary', fontWeight: 500, fontSize: '0.85rem', textTransform: 'none' }}
          >
            {t('rfBackToTime')}
          </Button>

          {/* Main Card */}
          <Card sx={{ overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ p: { xs: 3, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'flex-start' }, justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 700, letterSpacing: '-0.02em', mb: 1 }}>
                    {t('rfParticipantsTitle')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: t('rfParticipantsSubtitle', { room: `${room.roomNumber} - ${room.name}` }) }}
                  />
                </Box>
                <Chip
                  label={t('rfStepIndicator', { current: 2, total: 3 })}
                  size="small"
                  variant="outlined"
                  sx={{
                    borderColor: 'divider', color: 'text.secondary',
                    fontWeight: 600, fontSize: '0.65rem', letterSpacing: '0.04em',
                    textTransform: 'uppercase', borderRadius: 5, flexShrink: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Context Banner */}
            <Box sx={{ bgcolor: 'action.hover', px: { xs: 3, md: 4 }, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2, md: 4 } }}>
                {[
                  { icon: <CalendarTodayIcon sx={{ color: 'primary.main', fontSize: 22 }} />, label: t('rfDate'), value: fmtLongDate(formData.date) },
                  { icon: <AccessTimeIcon sx={{ color: 'primary.main', fontSize: 22 }} />, label: t('rfTime'), value: `${String(selectedStart).padStart(2, '0')}:00 - ${String(selectedEnd).padStart(2, '0')}:00 (${selectionDuration}h)` },
                  { icon: <MeetingRoomIcon sx={{ color: 'primary.main', fontSize: 22 }} />, label: t('rfRoom'), value: `${room.name} (${room.roomNumber})` },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {item.icon}
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: 'text.disabled', textTransform: 'uppercase' }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.value}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Content */}
            <Box sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* API Error */}
              {apiError && (
                <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => { setApiError(null); setMissingEmails([]); }}>
                  {apiError}
                  {missingEmails.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {missingEmails.map((e) => <Chip key={e} label={e} size="small" color="error" variant="outlined" />)}
                    </Box>
                  )}
                </Alert>
              )}

              {/* Capacity Progress */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('rfRoomCapacity')}</Typography>
                  <Chip
                    label={t('rfSeatsFilled', { count: totalPeople, max: maxCapacity })}
                    size="small"
                    sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', fontWeight: 600, fontSize: '0.75rem' }}
                  />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.min((totalPeople / maxCapacity) * 100, 100)}
                  sx={{
                    height: 10, borderRadius: 5, bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: totalPeople > maxCapacity ? 'error.main' : 'primary.main', transition: 'all 0.5s ease-out' },
                  }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                  <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{t('rfCapacityPolicy')}</Typography>
                </Box>
              </Box>

              {/* Add Participant Input */}
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 1.5 }}>{t('rfAddParticipant')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                  <TextField
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                    placeholder={t('rfEmailPlaceholder')}
                    size="small"
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5, color: 'text.disabled', fontSize: '1.1rem' }}>@</Box>
                      ),
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <Button
                    variant="outlined"
                    onClick={addEmail}
                    startIcon={<PersonAddIcon sx={{ fontSize: '20px !important' }} />}
                    sx={{
                      borderRadius: 2, fontWeight: 500, px: 3, whiteSpace: 'nowrap',
                      borderColor: 'grey.300', color: 'text.primary',
                      '&:hover': { bgcolor: 'action.hover', borderColor: 'grey.400' },
                    }}
                  >
                    {t('rfAdd')}
                  </Button>
                </Box>
              </Box>

              {/* Attendee List */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                <Box sx={{ bgcolor: 'action.hover', px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary' }}>
                    {t('rfCurrentAttendees', { count: totalPeople })}
                  </Typography>
                </Box>

                {/* Creator row */}
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2,
                  borderBottom: '1px solid', borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' }, transition: 'background-color 0.15s',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{
                      width: 40, height: 40,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main', fontWeight: 700, fontSize: '0.8rem',
                      border: '1px solid', borderColor: alpha(theme.palette.primary.main, 0.2),
                    }}>
                      {session?.user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {session?.user?.name} ({currentLang === 'tr' ? 'Siz' : 'You'})
                        </Typography>
                        <Chip label={t('rfOrganizer')} size="small" sx={{ bgcolor: 'primary.main', color: '#fff', fontWeight: 600, height: 20, fontSize: '0.65rem' }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{session?.user?.email}</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', fontStyle: 'italic', pr: 1, display: { xs: 'none', sm: 'block' } }}>
                    {t('rfCannotRemove')}
                  </Typography>
                </Box>

                {/* Participant rows */}
                {formData.participants.map((email) => {
                  const initials = email.split('@')[0].slice(0, 2).toUpperCase();
                  return (
                    <Box
                      key={email}
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2,
                        borderBottom: '1px solid', borderColor: 'divider',
                        '&:hover': { bgcolor: 'action.hover' }, transition: 'background-color 0.15s',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{
                          width: 40, height: 40,
                          bgcolor: 'grey.100', color: 'text.secondary',
                          fontWeight: 700, fontSize: '0.8rem',
                          border: '1px solid', borderColor: 'divider',
                        }}>
                          {initials}
                        </Avatar>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{email.split('@')[0]}</Typography>
                            <Chip
                              label={t('rfParticipant')}
                              size="small" variant="outlined"
                              sx={{ height: 20, fontSize: '0.65rem', borderColor: 'divider', color: 'text.secondary' }}
                            />
                          </Box>
                          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{email}</Typography>
                        </Box>
                      </Box>
                      <IconButton
                        onClick={() => removeEmail(email)}
                        sx={{
                          color: 'text.disabled',
                          '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.05) },
                        }}
                      >
                        <CloseIcon />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Footer Actions */}
            <Box sx={{
              p: { xs: 3, md: 4 }, borderTop: '1px solid', borderColor: 'divider',
              bgcolor: 'action.hover',
              display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2,
            }}>
              <Button
                variant="outlined"
                onClick={() => setStep(1)}
                sx={{
                  width: { xs: '100%', sm: 'auto' }, px: 3, py: 1.25, borderRadius: 2,
                  borderColor: 'grey.300', color: 'text.primary', fontWeight: 600,
                  '&:hover': { bgcolor: 'background.paper', borderColor: 'grey.400' },
                }}
              >
                {t('rfBack')}
              </Button>
              <Button
                variant="contained"
                disabled={!isCountValid || submitting}
                onClick={handleSubmit}
                endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardIcon sx={{ fontSize: '20px !important' }} />}
                sx={{
                  width: { xs: '100%', sm: 'auto' },
                  px: 4, py: 1.25, borderRadius: 2, fontWeight: 600,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
                  '&:hover': { boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.35)}` },
                }}
              >
                {submitting ? t('rfSubmitting') : t('rfConfirm')}
              </Button>
            </Box>
          </Card>
        </Box>
      )}

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackOpen(false)}>
          {t('rfSuccess')}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ReserveForm;
