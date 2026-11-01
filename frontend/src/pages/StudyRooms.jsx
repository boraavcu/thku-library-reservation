import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, TextField, Button, Chip, Slider,
  CircularProgress, InputAdornment
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';
import { getIstanbulNowInfo, toDateStr } from '../utils/dateUtils';

import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';

/**
 * Odanın seçilen [rangeStart, rangeEnd] saat aralığında en az requiredDuration (1, 2 veya 3 saat)
 * uzunluğunda kesintisiz, dolu olmayan ve geçmişte kalmamış bir zaman dilimi olup olmadığını kontrol eder.
 */
function hasContinuousAvailableSlot(room, selectedDate, todayStr, nowMinutes, timeRange, requiredDuration) {
  if (!room.isActive) return false;

  const [rangeStart, rangeEnd] = timeRange;
  const minDur = requiredDuration || 1;
  if (rangeEnd - rangeStart < minDur) return false;
  if (selectedDate < todayStr) return false;

  const isToday = selectedDate === todayStr;
  const occupiedBlocks = (room.occupiedSlots || []).map((s) => {
    const startH = new Date(s.startTime).getUTCHours();
    const endDt = new Date(s.endTime);
    const endH = endDt.getUTCHours() === 23 && endDt.getUTCMinutes() >= 59 ? 24 : endDt.getUTCHours();
    return { startH, endH };
  });

  const isHourFree = (hour) => {
    if (isToday && (hour + 1) * 60 <= nowMinutes) return false;
    return !occupiedBlocks.some((b) => hour >= b.startH && hour < b.endH);
  };

  let consecutiveFree = 0;
  for (let h = rangeStart; h < rangeEnd; h++) {
    if (isHourFree(h)) {
      consecutiveFree += 1;
      if (consecutiveFree >= minDur) return true;
    } else {
      consecutiveFree = 0;
    }
  }

  return false;
}

function StudyRooms() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status: authStatus } = useSession();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';
  const isEn = currentLang === 'en';
  const isBanned = Boolean(session?.user?.isBanned);

  const { todayStr: today, nowMinutes } = useMemo(() => getIstanbulNowInfo(), []);

  const [rooms, setRooms] = useState([]);
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [duration, setDuration] = useState(null);
  const [timeRange, setTimeRange] = useState([0, 24]);
  const [minCapacity, setMinCapacity] = useState(null);

  const maxSelectableDate = useMemo(() => {
    const max = new Date(`${today}T12:00:00`);
    max.setDate(max.getDate() + (maxAdvanceDays ?? 1));
    return toDateStr(max);
  }, [today, maxAdvanceDays]);

  const fetchRooms = useCallback(async (dateToFetch) => {
    try {
      const res = await api.get(`/rooms?date=${encodeURIComponent(dateToFetch)}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setRooms(list);
      if (list.length > 0 && typeof list[0].maxAdvanceDays === 'number') {
        setMaxAdvanceDays(list[0].maxAdvanceDays);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') { navigate('/'); return; }
    if (session?.user && !session.user.acceptedAgreementVersion) { navigate('/rules'); return; }
    fetchRooms(selectedDate);
  }, [authStatus, session, navigate, selectedDate, fetchRooms]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDate(today);
    setDuration(null);
    setTimeRange([0, 24]);
    setMinCapacity(null);
  };

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const isTimeOrDurationFiltered =
      duration !== null || timeRange[0] > 0 || timeRange[1] < 24;

    return rooms
      .filter((room) => room.isActive !== false)
      .filter((room) => {
        if (q) {
          const matchName = room.name?.toLowerCase().includes(q);
          const matchNumber = room.roomNumber?.toLowerCase().includes(q);
          if (!matchName && !matchNumber) return false;
        }

        if (minCapacity !== null && room.capacity < minCapacity) {
          return false;
        }

        if (isTimeOrDurationFiltered) {
          const hasSlot = hasContinuousAvailableSlot(
            room,
            selectedDate,
            today,
            nowMinutes,
            timeRange,
            duration || 1
          );
          if (!hasSlot) return false;
        }

        return true;
      });
  }, [rooms, searchQuery, minCapacity, duration, timeRange, selectedDate, today, nowMinutes]);

  if (authStatus === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <Box sx={{ flex: 1, maxWidth: 1400, mx: 'auto', width: '100%', px: { xs: 2, sm: 3, lg: 5 }, py: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.85rem' }, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {t('srTitle', isEn ? 'Study Rooms' : 'Çalışma Odaları')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {t('srSubtitle', isEn ? 'Select an available group study room to make a reservation.' : 'Rezervasyon yapmak için uygun bir grup çalışma odası seçin.')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, alignItems: 'flex-start' }}>
          {/* Sol Filtre Paneli */}
          <Card sx={{ width: { xs: '100%', lg: 310 }, flexShrink: 0, p: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {t('srFilters', isEn ? 'Filters' : 'Filtreler')}
              </Typography>
              <Button
                size="small"
                startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
                onClick={handleResetFilters}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
              >
                {t('srReset', isEn ? 'Reset' : 'Sıfırla')}
              </Button>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                size="small"
                fullWidth
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('srSearchPlaceholder', isEn ? 'Search room...' : 'Oda ara...')}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                }}
              />

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                  <CalendarTodayIcon sx={{ fontSize: 15, color: 'primary.main' }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                    {t('srDate', isEn ? 'Date' : 'Tarih')}
                  </Typography>
                </Box>
                <TextField
                  type="date"
                  size="small"
                  fullWidth
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  inputProps={{ min: today, max: maxSelectableDate }}
                />
              </Box>

              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <AccessTimeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {t('srTimeRange', isEn ? 'Time Range' : 'Saat Aralığı')}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'primary.main' }}>
                    {fmtHour(timeRange[0])} - {fmtHour(timeRange[1])}
                  </Typography>
                </Box>
                <Box sx={{ px: 1 }}>
                  <Slider
                    value={timeRange}
                    onChange={(_, val) => {
                      if (Array.isArray(val) && val[1] - val[0] >= 1) {
                        setTimeRange(val);
                      }
                    }}
                    min={0}
                    max={24}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={fmtHour}
                  />
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1 }}>
                  {t('srDuration', isEn ? 'Duration' : 'Süre')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[1, 2, 3].map((hrs) => (
                    <Button
                      key={hrs}
                      size="small"
                      fullWidth
                      variant={duration === hrs ? 'contained' : 'outlined'}
                      onClick={() => setDuration(duration === hrs ? null : hrs)}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                    >
                      {hrs} {isEn ? 'hr' : 'Saat'}
                    </Button>
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1 }}>
                  {t('srCapacity', isEn ? 'Min Capacity' : 'Minimum Kapasite')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[2, 4, 6, 8].map((cap) => (
                    <Button
                      key={cap}
                      size="small"
                      variant={minCapacity === cap ? 'contained' : 'outlined'}
                      onClick={() => setMinCapacity(minCapacity === cap ? null : cap)}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', flex: 1 }}
                    >
                      {cap}+
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>
          </Card>

          {/* Sağ Oda Listesi */}
          <Box sx={{ flex: 1, width: '100%' }}>
            {filteredRooms.length === 0 ? (
              <Card sx={{ p: 5, textAlign: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {isEn ? 'No available rooms match your filters' : 'Seçilen filtrelere uygun müsait oda bulunamadı'}
                </Typography>
                <Button variant="outlined" onClick={handleResetFilters} sx={{ mt: 1, textTransform: 'none' }}>
                  {t('srReset', isEn ? 'Reset Filters' : 'Filtreleri Sıfırla')}
                </Button>
              </Card>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
                {filteredRooms.map((room) => {
                  const hasSlotInFilter = hasContinuousAvailableSlot(
                    room,
                    selectedDate,
                    today,
                    nowMinutes,
                    timeRange,
                    duration || 1
                  );
                  const canBook = room.isActive && hasSlotInFilter;

                  return (
                    <Card
                      key={room.id}
                      sx={{
                        p: 2.5,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 2,
                        opacity: room.isActive ? 1 : 0.65,
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <MeetingRoomIcon sx={{ color: 'primary.main', fontSize: 22 }} />
                            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                              {room.roomNumber} - {room.name}
                            </Typography>
                          </Box>
                          <Chip
                            label={
                              !room.isActive
                                ? isEn ? 'Maintenance' : 'Bakımda'
                                : canBook
                                  ? t('rfAvailable', isEn ? 'Available' : 'Müsait')
                                  : isEn ? 'Full' : 'Dolu'
                            }
                            size="small"
                            color={!room.isActive ? 'warning' : canBook ? 'success' : 'error'}
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.68rem',
                              bgcolor: canBook ? alpha('#16a34a', 0.12) : undefined,
                              color: canBook ? '#16a34a' : undefined,
                            }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', mt: 1 }}>
                          <GroupIcon sx={{ fontSize: 16 }} />
                          <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                            {isEn ? `Capacity: 2 - ${room.capacity} People` : `Kapasite: 2 - ${room.capacity} Kişi`}
                          </Typography>
                        </Box>
                      </Box>

                      <Button
                        variant="contained"
                        fullWidth
                        disabled={!room.isActive || isBanned}
                        endIcon={!isBanned ? <ArrowForwardIcon /> : null}
                        onClick={() => !isBanned && navigate(`/reserve/new?roomId=${room.id}&date=${selectedDate}`)}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, py: 1 }}
                      >
                        {isBanned
                          ? isEn ? 'Account Suspended' : 'Hesap Askıda'
                          : !room.isActive
                            ? isEn ? 'Unavailable' : 'Kullanım Dışı'
                            : t('srBookNow', isEn ? 'Select Room' : 'Odayı Seç')}
                      </Button>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
}

export default StudyRooms;