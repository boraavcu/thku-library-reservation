import { useState } from 'react';
import {
  Box, Typography, Card, Alert, TextField, Button, Chip,
  Switch, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function RoomsTab({ rooms = [], isAdminOrSuper, isEn, runAction }) {
  const theme = useTheme();
  const [newRoom, setNewRoom] = useState({ roomNumber: '', name: '', capacity: 8 });
  const [editRoomDialog, setEditRoomDialog] = useState({
    open: false,
    roomId: null,
    roomNumber: '',
    name: '',
    capacity: 8,
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        {isEn ? (
          <>When you turn off a study room switch (Maintenance), <strong>existing confirmed bookings are NOT cancelled</strong>; only new reservations are paused.</>
        ) : (
          <>Bir çalışma odasını anahtardan kapattığınızda (Bakıma Aldığınızda), o odaya ait <strong>mevcut onaylı randevular iptal edilmez</strong>; yalnızca yeni randevu alımı durdurulur.</>
        )}
      </Alert>

      {isAdminOrSuper && (
        <Box sx={{ p: 2.5, bgcolor: 'action.hover', borderRadius: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: 'stretch' }}>
          <TextField
            label={isEn ? 'Room Code (e.g. R105)' : 'Oda Kodu (Örn: R105)'}
            size="small"
            value={newRoom.roomNumber}
            onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label={isEn ? 'Room Name (e.g. Vecihi)' : 'Oda Adı (Örn: Vecihi)'}
            size="small"
            fullWidth
            value={newRoom.name}
            onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
            sx={{ bgcolor: 'background.paper' }}
          />
          <TextField
            label={isEn ? 'Capacity' : 'Kapasite'}
            type="number"
            size="small"
            value={newRoom.capacity}
            onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
            sx={{ width: { xs: '100%', sm: 120 }, bgcolor: 'background.paper' }}
          />
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => {
              runAction('CREATE_ROOM', newRoom, 'Yeni çalışma odası eklendi.');
              setNewRoom({ roomNumber: '', name: '', capacity: 8 });
            }}
            sx={{ whiteSpace: 'nowrap', py: 1 }}
          >
            {isEn ? 'Add Room' : 'Oda Ekle'}
          </Button>
        </Box>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        {rooms.map((room) => (
          <Card
            key={room.id}
            sx={{
              p: 2.5,
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1.5,
              borderLeft: `4px solid ${room.isActive ? theme.palette.success.main : theme.palette.error.main}`,
            }}
          >
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {room.roomNumber} - {room.name}
                </Typography>
                <Chip
                  label={room.isActive ? (isEn ? 'ACTIVE (OPEN)' : 'AKTİF (AÇIK)') : (isEn ? 'PAUSED FOR NEW BOOKINGS' : 'YENİ RANDEVUYA KAPALI')}
                  size="small"
                  color={room.isActive ? 'success' : 'error'}
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {isEn ? 'Max Capacity:' : 'Maksimum Kapasite:'} <strong>{room.capacity} {isEn ? 'People' : 'Kişi'}</strong>
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={room.isActive ? 'Yeni Randevulara Kapat (Mevcutlar Korunur)' : 'Odayı Yeni Rezervasyona Aç'}>
                <Switch
                  checked={room.isActive}
                  color="success"
                  onChange={(e) =>
                    runAction(
                      'TOGGLE_ROOM',
                      { roomId: room.id, isActive: e.target.checked },
                      `${room.roomNumber} ${e.target.checked ? 'yeni rezervasyonlara açıldı' : 'yeni rezervasyonlara kapatıldı (mevcut randevular korunuyor)'}.`
                    )
                  }
                />
              </Tooltip>

              {isAdminOrSuper && (
                <Tooltip title="Oda Adını ve Kapasitesini Düzenle">
                  <IconButton
                    color="primary"
                    size="small"
                    onClick={() =>
                      setEditRoomDialog({
                        open: true,
                        roomId: room.id,
                        roomNumber: room.roomNumber,
                        name: room.name,
                        capacity: room.capacity,
                      })
                    }
                  >
                    <EditOutlinedIcon />
                  </IconButton>
                </Tooltip>
              )}

              {isAdminOrSuper && (
                <Tooltip title="Odayı Kalıcı Olarak Sil">
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => {
                      if (window.confirm(`${room.roomNumber} - ${room.name} odasını silmek istediğinize emin misiniz?`)) {
                        runAction('DELETE_ROOM', { roomId: room.id }, 'Oda sistemden silindi.');
                      }
                    }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Card>
        ))}
      </Box>

      <Dialog
        open={editRoomDialog.open}
        onClose={() => setEditRoomDialog({ ...editRoomDialog, open: false })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Çalışma Odası Bilgilerini Düzenle</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField
            label="Oda Kodu"
            size="small"
            fullWidth
            value={editRoomDialog.roomNumber}
            onChange={(e) => setEditRoomDialog({ ...editRoomDialog, roomNumber: e.target.value })}
          />
          <TextField
            label="Oda İsmi"
            size="small"
            fullWidth
            value={editRoomDialog.name}
            onChange={(e) => setEditRoomDialog({ ...editRoomDialog, name: e.target.value })}
          />
          <TextField
            label="Maksimum Kapasite (Kişi)"
            type="number"
            size="small"
            fullWidth
            value={editRoomDialog.capacity}
            onChange={(e) => setEditRoomDialog({ ...editRoomDialog, capacity: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditRoomDialog({ ...editRoomDialog, open: false })} color="inherit">
            Vazgeç
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              runAction(
                'UPDATE_ROOM',
                {
                  roomId: editRoomDialog.roomId,
                  roomNumber: editRoomDialog.roomNumber,
                  name: editRoomDialog.name,
                  capacity: editRoomDialog.capacity,
                },
                'Oda bilgileri başarıyla güncellendi.'
              );
              setEditRoomDialog({ ...editRoomDialog, open: false });
            }}
          >
            Değişiklikleri Kaydet
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}