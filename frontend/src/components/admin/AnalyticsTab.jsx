import { Box, Typography, Paper, Button, Chip, LinearProgress, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import RadarIcon from '@mui/icons-material/Radar';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsightsIcon from '@mui/icons-material/Insights';
import SchoolIcon from '@mui/icons-material/School';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import RoomDensityChart from '../dashboard/RoomDensityChart';
import { DEPT_EN_MAP } from './adminConstants';

export default function AnalyticsTab({ analytics, isEn, onPrintPdf }) {
  const theme = useTheme();
  const maxHeatCount = Math.max(1, ...(analytics?.hourlyHeatmap?.map((h) => h.count) || [1]));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, '@media print': { gap: 2 } }}>
      <Paper
        elevation={0}
        sx={{
          p: 2.25,
          borderRadius: 2.5,
          bgcolor: alpha(theme.palette.info.main, 0.06),
          border: '1px solid',
          borderColor: alpha(theme.palette.info.main, 0.2),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <RadarIcon color="info" fontSize="large" />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {isEn
                ? 'Next 1-Hour Operations Radar (Live Desk & Door QR Tracking)'
                : 'Gelecek 1 Saat Operasyon Radarı (Canlı Banko & Kapı QR Takibi)'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isEn ? (
                <>
                  Currently <strong>{analytics?.activeNowRooms || 0} active group(s)</strong> in study rooms. Within the next 60 minutes, <strong>{analytics?.upcomingHourReservations || 0} new group(s) ({analytics?.upcomingHourStudents || 0} students)</strong> will perform door QR check-in.
                </>
              ) : (
                <>
                  Şu an odalarda aktif <strong>{analytics?.activeNowRooms || 0} grup</strong> bulunuyor. Önümüzdeki 60 dakika içinde <strong>{analytics?.upcomingHourReservations || 0} yeni grup ({analytics?.upcomingHourStudents || 0} öğrenci)</strong> kapı QR doğrulaması yapacak.
                </>
              )}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<PictureAsPdfIcon />}
          onClick={onPrintPdf}
          sx={{ '@media print': { display: 'none' } }}
        >
          {isEn ? 'Save Page as PDF' : 'Bu Sayfayı PDF Olarak Kaydet'}
        </Button>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
          '@media print': { gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 },
        }}
      >
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, breakInside: 'avoid' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <InsightsIcon color="success" fontSize="small" />
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
              {isEn ? 'BOOKING COMPLETION & DISCIPLINE RATE' : 'RANDEVU GERÇEKLEŞME & DİSİPLİN ORANI'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Chip
              label={isEn ? `Completed: ${analytics?.completionRate ?? 85}%` : `Tamamlanan: %${analytics?.completionRate ?? 85}`}
              color="success"
              size="small"
              sx={{ fontWeight: 700 }}
            />
            <Chip
              label={isEn ? `Cancelled: ${analytics?.cancellationRate ?? 8}%` : `İptal: %${analytics?.cancellationRate ?? 8}`}
              color="info"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
            <Chip
              label={`No-Show: %${analytics?.noShowRate ?? 7}`}
              color="error"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 700 }}
            />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, breakInside: 'avoid' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block' }}>
            {isEn ? 'AVERAGE GROUP SIZE' : 'ORTALAMA GRUP BÜYÜKLÜĞÜ'}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', mt: 0.5 }}>
            {analytics?.avgGroupSize || '3.2'} {isEn ? 'Students / Group' : 'Öğrenci / Grup'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isEn ? 'Based on 2–8 person room capacity' : 'Min 2 – Maks 8 kişilik oda kapasitesi üzerinden'}
          </Typography>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, breakInside: 'avoid' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block' }}>
            {isEn ? 'AVERAGE STUDY DURATION' : 'ORTALAMA ÇALIŞMA SÜRESİ'}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'secondary.main', mt: 0.5 }}>
            {analytics?.avgDurationHours || '2.4'} {isEn ? 'Hours / Session' : 'Saat / Oturum'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isEn ? 'Based on max 3-hour daily session limit' : 'Maksimum 3 saatlik oturum kotası üzerinden'}
          </Typography>
        </Paper>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.5,
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
          '@media print': { gridTemplateColumns: '1fr 1fr', gap: 1.5 },
        }}
      >
        <Box sx={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <RoomDensityChart />
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <SchoolIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {isEn ? 'Usage Breakdown by Department' : 'Bölüm Bazlı Kullanım Dağılımı'}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {isEn
              ? 'Share of faculties and departments actively using study rooms (Activity Report Data).'
              : 'Çalışma odalarını en aktif kullanan fakülte ve bölümlerin oranı (Faaliyet Raporu Verisi).'}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            {(analytics?.departmentBreakdown || []).map((dept) => {
              const deptName = isEn ? DEPT_EN_MAP[dept.name] || dept.name : dept.name;
              return (
                <Box key={dept.name}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                      {deptName}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                      %{dept.percentage} ({dept.count} {isEn ? 'Sessions' : 'Katılım'})
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={dept.percentage} sx={{ height: 8, borderRadius: 4 }} />
                </Box>
              );
            })}
          </Box>
        </Paper>
      </Box>

      {analytics?.roomBreakdown?.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <MeetingRoomIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {isEn
                ? 'Study Room Preference & Total Usage Ranking'
                : 'Çalışma Odası Tercih & Toplam Kullanım Sıralaması'}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {isEn
              ? 'Comparison of total confirmed bookings and total study hours across the 4 study rooms.'
              : '4 çalışma odasının toplam onaylanan randevu sayısı ve toplam çalışma saati karşılaştırması.'}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {analytics.roomBreakdown.map((rm) => (
              <Paper key={rm.roomNumber} variant="outlined" sx={{ p: 1.75, borderRadius: 2, breakInside: 'avoid' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    {rm.roomNumber} - {rm.name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    {rm.count} {isEn ? 'Bookings' : 'Randevu'} ({rm.hoursBooked} {isEn ? 'Hrs' : 'Saat'})
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={rm.percentage} sx={{ height: 7, borderRadius: 4 }} />
              </Paper>
            ))}
          </Box>
        </Paper>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <WhatshotIcon color="warning" fontSize="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {isEn
              ? '24/7 Hourly Occupancy Heatmap (Peak Hours)'
              : '7/24 Saatlik Yoğunluk Isı Haritası (Peak Hours Heatmap)'}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {isEn
            ? 'Shows which hourly slots between 00:00 – 24:00 are most preferred by student groups.'
            : '00:00 – 24:00 arası hangi saat dilimlerinde çalışma odalarının daha çok tercih edildiğini gösterir.'}
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(6, 1fr)', md: 'repeat(8, 1fr)' }, gap: 1 }}>
          {(analytics?.hourlyHeatmap || []).map((slot) => {
            const ratio = slot.count / maxHeatCount;
            const bg =
              slot.count === 0
                ? alpha(theme.palette.text.disabled, 0.08)
                : ratio > 0.7
                ? alpha(theme.palette.error.main, 0.85)
                : ratio > 0.35
                ? alpha(theme.palette.warning.main, 0.75)
                : alpha(theme.palette.primary.main, 0.55);
            const textCol = slot.count === 0 ? 'text.secondary' : '#fff';

            return (
              <Tooltip key={slot.hour} title={`${slot.hour}: ${slot.count} ${isEn ? 'bookings' : 'rezervasyon'}`}>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: bg,
                    color: textCol,
                    textAlign: 'center',
                    '@media print': {
                      border: '1px solid #CBD5E1',
                      WebkitPrintColorAdjust: 'exact',
                      printColorAdjust: 'exact',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800 }}>{slot.hour}</Typography>
                  <Typography sx={{ fontSize: '0.68rem', opacity: 0.9 }}>
                    {slot.count} {isEn ? 'Groups' : 'Grup'}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}