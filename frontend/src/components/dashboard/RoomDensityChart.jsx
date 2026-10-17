import { useEffect, useState } from 'react';
import { Box, Typography, Card, CircularProgress, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import api from '../../api';
import BarChartIcon from '@mui/icons-material/BarChart';

const getBarColor = (pct, theme) => {
  if (pct >= 75) return theme.palette.error.main;
  if (pct >= 40) return theme.palette.warning.main;
  return theme.palette.success.main;
};

const CustomTooltip = ({ active, payload, t }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <Box sx={{
      bgcolor: 'background.paper', px: 2, py: 1.5, borderRadius: 2,
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      border: '1px solid', borderColor: 'divider',
    }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5 }}>
        {d.name} ({d.roomNumber})
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
        {t('rdBooked', { hours: d.bookedHours, total: d.totalHours })}
      </Typography>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, mt: 0.5 }}>
        %{d.occupancyPercent}
      </Typography>
    </Box>
  );
};

export default function RoomDensityChart() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/room-density')
      .then((res) => setData(res.data))
      .catch(() => setData({ rooms: [], averageOccupancy: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress size={24} />
      </Card>
    );
  }

  const rooms = data?.rooms || [];
  const avg = data?.averageOccupancy || 0;

  return (
    <Card sx={{ p: 3, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BarChartIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
            {t('rdTitle')}
          </Typography>
        </Box>
        <Chip
          label={t('rdAverage', { pct: avg })}
          size="small"
          sx={{
            bgcolor: alpha(getBarColor(avg, theme), 0.1),
            color: getBarColor(avg, theme),
            fontWeight: 700, fontSize: '0.7rem', height: 24,
          }}
        />
      </Box>

      {rooms.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
          {t('rdNoData')}
        </Typography>
      ) : (
        <Box sx={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rooms}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              barCategoryGap="25%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={alpha(theme.palette.divider, 0.5)}
              />
              <XAxis
                dataKey="roomNumber"
                tick={{ fontSize: 11, fill: theme.palette.text.secondary, fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: theme.palette.text.disabled }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={<CustomTooltip t={t} />}
                cursor={{ fill: alpha(theme.palette.primary.main, 0.04) }}
              />
              {avg > 0 && (
                <ReferenceLine
                  y={avg}
                  stroke={theme.palette.text.disabled}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}
              <Bar
                dataKey="occupancyPercent"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              >
                {rooms.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={getBarColor(entry.occupancyPercent, theme)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        {[
          { color: theme.palette.success.main, label: t('rdLow') },
          { color: theme.palette.warning.main, label: t('rdMedium') },
          { color: theme.palette.error.main, label: t('rdHigh') },
        ].map((item) => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 500 }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
}
