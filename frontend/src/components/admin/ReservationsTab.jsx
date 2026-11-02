import { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Select, MenuItem, Chip, Alert,
  Paper, Divider, Button, Pagination, InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { ITEMS_PER_PAGE } from './adminConstants';
import { fmtTimeUTC, fmtDateShortUTC } from '../../utils/dateUtils';

export default function ReservationsTab({ reservations = [], rooms = [], isEn, runAction }) {
  const [resFilter, setResFilter] = useState('ACTIVE');
  const [resSearch, setResSearch] = useState('');
  const [resRoomFilter, setResRoomFilter] = useState('ALL');
  const [resPage, setResPage] = useState(1);

  const filteredReservations = useMemo(() => {
    const q = resSearch.trim().toLowerCase();

    return reservations.filter((r) => {
      if (resFilter === 'ACTIVE' && !['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status)) return false;
      if (resFilter === 'COMPLETED' && r.status !== 'COMPLETED') return false;
      if (resFilter === 'CANCELLED' && !['CANCELLED', 'NO_SHOW'].includes(r.status)) return false;

      if (resRoomFilter !== 'ALL' && r.room?.roomNumber !== resRoomFilter) return false;

      if (q) {
        const orgMatch =
          (r.user?.fullName || '').toLowerCase().includes(q) ||
          (r.user?.email || '').toLowerCase().includes(q) ||
          (r.user?.phone || '').toLowerCase().includes(q) ||
          (r.user?.studentNumber || '').toLowerCase().includes(q) ||
          (r.user?.department || '').toLowerCase().includes(q);

        const roomMatch =
          (r.room?.roomNumber || '').toLowerCase().includes(q) ||
          (r.room?.name || '').toLowerCase().includes(q) ||
          (r.purpose || '').toLowerCase().includes(q);

        const partMatch = (r.participants || []).some(
          (p) =>
            (p.user?.fullName || '').toLowerCase().includes(q) ||
            (p.user?.email || '').toLowerCase().includes(q) ||
            (p.user?.phone || '').toLowerCase().includes(q)
        );

        if (!orgMatch && !roomMatch && !partMatch) return false;
      }

      return true;
    });
  }, [reservations, resFilter, resRoomFilter, resSearch]);

  const paginatedReservations = useMemo(() => {
    const start = (resPage - 1) * ITEMS_PER_PAGE;
    return filteredReservations.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReservations, resPage]);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder={
            isEn
              ? 'Search reservations (Student name, email, phone, student ID, room, or purpose)...'
              : 'Rezervasyonlarda ara (Öğrenci adı, e-posta, telefon no, öğrenci no, oda adı veya çalışma amacı)...'
          }
          value={resSearch}
          onChange={(e) => {
            setResSearch(e.target.value);
            setResPage(1);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
        <Select
          size="small"
          value={resRoomFilter}
          onChange={(e) => {
            setResRoomFilter(e.target.value);
            setResPage(1);
          }}
          sx={{ minWidth: { xs: '100%', sm: 190 } }}
        >
          <MenuItem value="ALL">{isEn ? 'All Rooms (R101-R104)' : 'Tüm Odalar (R101-R104)'}</MenuItem>
          {rooms.map((rm) => (
            <MenuItem key={rm.id} value={rm.roomNumber}>
              {rm.roomNumber} - {rm.name}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={isEn ? 'Active & Pending' : 'Devam Eden & Bekleyenler'}
            color={resFilter === 'ACTIVE' ? 'primary' : 'default'}
            onClick={() => {
              setResFilter('ACTIVE');
              setResPage(1);
            }}
            sx={{ fontWeight: 700, cursor: 'pointer' }}
          />
          <Chip
            label={isEn ? 'Completed (History)' : 'Tamamlananlar (Geçmiş)'}
            color={resFilter === 'COMPLETED' ? 'success' : 'default'}
            onClick={() => {
              setResFilter('COMPLETED');
              setResPage(1);
            }}
            sx={{ fontWeight: 700, cursor: 'pointer' }}
          />
          <Chip
            label={isEn ? 'Cancelled & No-Show' : 'İptal & No-Show (Uyarı Alanlar)'}
            color={resFilter === 'CANCELLED' ? 'error' : 'default'}
            onClick={() => {
              setResFilter('CANCELLED');
              setResPage(1);
            }}
            sx={{ fontWeight: 700, cursor: 'pointer' }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {isEn ? `Found: ${filteredReservations.length} records` : `Bulunan: ${filteredReservations.length} kayıt`}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {paginatedReservations.length === 0 ? (
          <Alert severity="info">
            {isEn ? 'No reservations match your search criteria.' : 'Arama kriterlerinize uygun rezervasyon kaydı bulunamadı.'}
          </Alert>
        ) : (
          paginatedReservations.map((r) => {
            const hasActions = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status);
            return (
              <Paper
                key={r.id}
                variant="outlined"
                sx={{
                  p: { xs: 1.75, sm: 2.25 },
                  borderRadius: 2,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
                      {r.room?.roomNumber} - {r.room?.name}
                    </Typography>
                    <Chip
                      label={r.status}
                      size="small"
                      color={
                        r.status === 'CHECKED_IN' || r.status === 'CONFIRMED'
                          ? 'success'
                          : r.status === 'COMPLETED'
                          ? 'info'
                          : r.status === 'PENDING'
                          ? 'warning'
                          : 'error'
                      }
                      sx={{ fontWeight: 700, height: 22 }}
                    />
                    {typeof r.checkedInCount === 'number' && r.checkedInCount > 0 && (
                      <Chip
                        label={`Kiosk QR: ${r.checkedInCount} Kişi`}
                        size="small"
                        variant="outlined"
                        color="success"
                        sx={{ fontWeight: 700, height: 22, fontSize: '0.7rem' }}
                      />
                    )}
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {fmtDateShortUTC(r.reservationDate, isEn)} | {fmtTimeUTC(r.startTime)} - {fmtTimeUTC(r.endTime)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                    {isEn ? 'Organizer:' : 'Organizatör:'} {r.user?.fullName} ({r.user?.email})
                    {r.user?.phone ? ` • 📞 ${r.user.phone}` : ''} • {r.user?.department || '-'}
                  </Typography>
                  {r.purpose && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontWeight: 600 }}>
                      {isEn ? 'Purpose:' : 'Çalışma Amacı:'} {r.purpose}
                    </Typography>
                  )}
                  {r.participants?.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                      {r.participants.map((p, idx) => (
                        <Chip
                          key={idx}
                          size="small"
                          variant="outlined"
                          label={`${p.user?.fullName || p.user?.email}${p.user?.phone ? ` (📞 ${p.user.phone})` : ''} (${p.status})`}
                          color={p.status === 'ACCEPTED' ? 'success' : p.status === 'REJECTED' ? 'error' : 'warning'}
                          sx={{ height: 22, fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>

                {hasActions && (
                  <>
                    <Divider />
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      {['PENDING', 'CONFIRMED'].includes(r.status) && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          startIcon={<CheckCircleOutlineIcon />}
                          onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'FORCE_CHECKIN' }, 'Manuel Check-In yapıldı.')}
                        >
                          {isEn ? 'Manual Check-In' : 'Manuel Check-In'}
                        </Button>
                      )}

                      {['CONFIRMED', 'CHECKED_IN'].includes(r.status) && (
                        <Button
                          size="small"
                          variant="contained"
                          color="info"
                          startIcon={<DoneAllIcon />}
                          onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'EARLY_FINISH' }, 'Oda erken boşaltıldı ve kalan saatler boşa çıkarıldı.')}
                        >
                          {isEn ? 'Early Check-Out' : 'Erken Bitir (Boşalt)'}
                        </Button>
                      )}

                      {['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status) && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          disabled={Boolean(r.penaltyApplied)}
                          onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'MARK_NO_SHOW' }, 'Kiosk onayı vermeyenlere No-Show uyarısı (1/3) işlendi.')}
                        >
                          {r.penaltyApplied
                            ? isEn ? 'No-Show Applied' : 'No-Show İşlendi'
                            : isEn ? 'Issue No-Show Warning' : 'No-Show Uyarısı Ver'}
                        </Button>
                      )}

                      {['PENDING', 'CONFIRMED'].includes(r.status) && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          onClick={() => runAction('RESERVATION_OP', { reservationId: r.id, op: 'CANCEL' }, 'Rezervasyon iptal edildi ve bildirim mailleri gönderildi.')}
                        >
                          {isEn ? 'Cancel' : 'İptal Et'}
                        </Button>
                      )}
                    </Box>
                  </>
                )}
              </Paper>
            );
          })
        )}
      </Box>

      {filteredReservations.length > ITEMS_PER_PAGE && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={Math.ceil(filteredReservations.length / ITEMS_PER_PAGE)}
            page={resPage}
            onChange={(_, p) => setResPage(p)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
