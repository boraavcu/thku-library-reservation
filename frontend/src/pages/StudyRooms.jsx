import { useEffect, useState, useMemo } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Button, Paper, Chip, TextField, Collapse,
  CircularProgress, Alert, Slider
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import TuneIcon from '@mui/icons-material/Tune';
import GroupIcon from '@mui/icons-material/Group';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const LIBRARY_OPEN = 0;
const LIBRARY_CLOSE = 24;

function StudyRooms() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status: authStatus } = useSession();
  const { t, i18n } = useTranslation();
  const isBanned = Boolean(session?.user?.isBanned);

  const [rooms, setRooms] = useState([]);
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  const [selectedDate, setSelectedDate] = useState(today);
  const [duration, setDuration] = useState(1);
  const [timeRange, setTimeRange] = useState([LIBRARY_OPEN, LIBRARY_CLOSE]);

  // İleri tarih varsayılan 1 gün
  const maxDate = useMemo(() => {
    const advanceDays = rules?.maxAdvanceDays ?? 1;
    const max = new Date(today + 'T12:00:00');
    max.setDate(max.getDate() + advanceDays);
    return max.toISOString().split('T')[0];
  }, [rules, today]);

  const fmtHour = (h) => `${String(h).padStart(2, '0')}:00`;

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') { navigate('/'); return; }
    if (session?.user && !session.user.acceptedAgreementVersion) navigate('/rules');
  }, [session, authStatus, navigate]);

  useEffect(() => {
    if (authStatus === 'loading' || !session?.user?.acceptedAgreementVersion) return;
    api.get('/reserve/init')
      .then(res => {
        setRooms(res.data.rooms);
        setRules(res.data.rules);
        setLoading(false);
      })
      .catch(() => {
        setError(t('srFetchError'));
        setLoading(false);
      });
  }, [authStatus, session, t]);

  const filteredRooms = useMemo(() => rooms.filter(r => r.isActive !== false), [rooms]);

  const displayDate = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }, [selectedDate, i18n.language]);

  const displaySelectedDate = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }, [selectedDate]);

  if (authStatus === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!session?.user?.acceptedAgreementVersion) return null;
  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const filterContent = (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
          {t('srReservationDate')}
        </Typography>
        <TextField
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          inputProps={{ min: today, max: maxDate }}
          fullWidth
          size="small"
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.5, display: 'block' }}>
          {displaySelectedDate}
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5 }}>
          {t('srTimeDuration')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {[
            { value: 1, label: t('srOneHour') },
            { value: 2, label: t('srTwoHours') },
            { value: 3, label: t('srThreeHours') },
          ].map(opt => (
            <Chip
              key={opt.value}
              label={opt.label}
              variant={duration === opt.value ? 'filled' : 'outlined'}
              onClick={() => setDuration(opt.value)}
              sx={{
                cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                ...(duration === opt.value
                  ? { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } }
                  : { borderColor: 'divider', color: 'text.primary', '&:hover': { bgcolor: 'action.hover' } }
                ),
              }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {t('srTimeRange')}
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
            {fmtHour(timeRange[0])} – {fmtHour(timeRange[1])}
          </Typography>
        </Box>
        <Box sx={{ px: 1 }}>
          <Slider
            value={timeRange}
            onChange={(_, newVal) => setTimeRange(newVal)}
            min={LIBRARY_OPEN}
            max={LIBRARY_CLOSE}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={fmtHour}
            disableSwap
            sx={{
              '& .MuiSlider-thumb': { width: 16, height: 16 },
              '& .MuiSlider-rail': { opacity: 0.2 },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: -0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>{fmtHour(LIBRARY_OPEN)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>{fmtHour(LIBRARY_CLOSE)}</Typography>
        </Box>
      </Box>

      <Box sx={{
        p: 2, mb: 3, borderRadius: 2,
        bgcolor: alpha(theme.palette.info.main, 0.06),
        border: '1px solid', borderColor: alpha(theme.palette.info.main, 0.15),
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.8rem' }}>
            {t('srRulesInfoTitle')}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.6 }}>
          {t('srRulesInfo', { maxHours: rules?.maxDurationHours ?? 3, maxCapacity: rules?.maxParticipants ?? 8 })}
        </Typography>
      </Box>
    </>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            width: 280, flexShrink: 0,
            bgcolor: 'background.paper',
            borderRight: '1px solid', borderColor: 'divider',
            p: 3,
            position: 'sticky', top: 64,
            height: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <TuneIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>{t('srFilterCriteria')}</Typography>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', mb: 3 }}>
            {t('srFilterSubtitle')}
          </Typography>
          {filterContent}
        </Box>

        <Box sx={{ flex: 1, p: { xs: 2, sm: 3, md: 4 } }}>
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setFiltersOpen(!filtersOpen)}
              startIcon={<TuneIcon />}
              endIcon={filtersOpen ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
              sx={{
                justifyContent: 'space-between',
                borderColor: 'divider', color: 'text.primary',
                fontWeight: 600, borderRadius: 2, py: 1.25,
              }}
            >
              {t('srFiltersAndDate')}
            </Button>
            <Collapse in={filtersOpen}>
              <Paper elevation={0} sx={{ mt: 1, p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                {filterContent}
              </Paper>
            </Collapse>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Box sx={{
              display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { sm: 'flex-end' }, justifyContent: 'space-between',
              gap: 1,
            }}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {t('srAvailableRooms')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t('srShowingRooms', { count: filteredRooms.length })}{' '}
                  <strong>{displayDate}</strong>
                </Typography>
              </Box>
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                color: 'text.secondary', flexShrink: 0,
                bgcolor: alpha(theme.palette.info.main, 0.06),
                px: 1.5, py: 0.75, borderRadius: 2,
              }}>
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                  {t('srMaxBooking', { hours: rules?.maxDurationHours ?? 3 })}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredRooms.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body1" color="text.secondary">{t('srNoRooms')}</Typography>
              </Paper>
            ) : (
              filteredRooms.map((room) => (
                <Card
                  key={room.id}
                  sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    borderLeft: `4px solid ${theme.palette.success.main}`,
                    transition: 'box-shadow 0.2s, transform 0.2s',
                    '&:hover': {
                      boxShadow: '0 8px 25px -5px rgba(0,0,0,0.1)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  <Box sx={{ flex: 1, p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                      <Typography variant="h6" sx={{ fontSize: '1.1rem' }}>
                        Room {room.roomNumber} - {room.name}
                      </Typography>
                      <Chip
                        label={t('srAvailable')}
                        size="small"
                        sx={{
                          bgcolor: 'success.main', color: '#fff',
                          fontWeight: 700, fontSize: '0.65rem',
                          height: 22, letterSpacing: '0.03em',
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                      <GroupIcon sx={{ fontSize: 18 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('srCapacity', { count: room.capacity })}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 }, p: 2.5, pt: { xs: 0, sm: 2.5 } }}>
                    <Button
                      variant="contained"
                      disabled={isBanned}
                      onClick={() => !isBanned && navigate(`/reserve/new?roomId=${room.id}&date=${selectedDate}`)}
                      endIcon={!isBanned ? <ArrowForwardIcon /> : null}
                      sx={{ minWidth: 110, borderRadius: 2 }}
                    >
                      {isBanned ? (i18n.language === 'tr' ? 'Hesap Askıda' : 'Suspended') : t('srSelect')}
                    </Button>
                  </Box>
                </Card>
              ))
            )}
          </Box>
        </Box>
      </Box>

      <Footer />
    </Box>
  );
}

export default StudyRooms;