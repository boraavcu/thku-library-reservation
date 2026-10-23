import { useEffect, useState } from 'react';
import { Card, Box, Typography, CircularProgress, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useTranslation } from 'react-i18next';
import api from '../../api';

export default function RoomDensityChart() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const [rooms, setRooms] = useState([]);
  const [avgPct, setAvgPct] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/room-density')
      .then((res) => {
        const rawList = Array.isArray(res.data) ? res.data : res.data?.rooms || [];
        const normalized = rawList.map((r) => ({
          ...r,
          occupancyPercent: Number(
            r.occupancyPercent ?? r.percentage ?? r.density ?? 0
          ),
          bookedHours: Number(r.bookedHours ?? 0),
          totalHours: Number(r.totalHours ?? 24),
        }));
        setRooms(normalized);

        if (
          res.data?.averageOccupancy !== undefined ||
          res.data?.averagePercentage !== undefined
        ) {
          setAvgPct(
            Number(res.data.averageOccupancy ?? res.data.averagePercentage ?? 0)
          );
        } else if (normalized.length > 0) {
          const sum = normalized.reduce((acc, cur) => acc + cur.occupancyPercent, 0);
          setAvgPct(Math.round(sum / normalized.length));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getBarColor = (pct) => {
    if (pct >= 75) return theme.palette.error.main;
    if (pct >= 40) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  return (
    <Card
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {isEn ? "Today's Room Occupancy" : t('todaysRoomDensity', 'Bugünkü Oda Yoğunluğu')}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              px: 1,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha(getBarColor(avgPct), 0.12),
              color: getBarColor(avgPct),
            }}
          >
            {isEn ? `Avg: ${avgPct}%` : `Ort: %${avgPct}`}
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', height: 170, gap: 1.5, pt: 1, pb: 1 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                pr: 1,
                color: 'text.disabled',
                fontSize: '0.68rem',
                fontWeight: 600,
              }}
            >
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </Box>

            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-around',
                position: 'relative',
                borderBottom: '1px solid',
                borderColor: 'divider',
                pb: 0.5,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  bottom: `${avgPct}%`,
                  left: 0,
                  right: 0,
                  borderTop: '1.5px dashed',
                  borderColor: alpha(theme.palette.text.secondary, 0.35),
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />

              {rooms.map((r) => {
                const pctVal = Number(r.occupancyPercent || 0);
                const barCol = getBarColor(pctVal);
                return (
                  <Tooltip
                    key={r.roomNumber}
                    title={
                      isEn
                        ? `${r.roomNumber} - ${r.name}: ${pctVal}% (${r.bookedHours}/${r.totalHours} hrs)`
                        : `${r.roomNumber} - ${r.name}: %${pctVal} (${r.bookedHours}/${r.totalHours} saat dolu)`
                    }
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '18%',
                        height: '100%',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Box
                        sx={{
                          width: '100%',
                          maxWidth: 36,
                          height: `${Math.max(6, pctVal)}%`,
                          bgcolor: barCol,
                          borderRadius: '6px 6px 2px 2px',
                          transition: 'height 0.4s ease',
                          '@media print': {
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                          },
                        }}
                      />
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-around', pl: 4, mt: 0.5 }}>
          {rooms.map((r) => (
            <Typography key={r.roomNumber} variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              {r.roomNumber}
            </Typography>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2,
          mt: 2,
          pt: 1.5,
          borderTop: '1px solid',
          borderColor: 'divider',
          flexWrap: 'wrap',
        }}
      >
        {[
          { color: theme.palette.success.main, label: isEn ? 'Low (<40%)' : 'Düşük (<%40)' },
          { color: theme.palette.warning.main, label: isEn ? 'Medium (40-75%)' : 'Orta (%40-75)' },
          { color: theme.palette.error.main, label: isEn ? 'High (>75%)' : 'Yüksek (>%75)' },
        ].map((item) => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
}