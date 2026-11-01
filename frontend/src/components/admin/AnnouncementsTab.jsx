import { useState } from 'react';
import { Box, Typography, TextField, Select, MenuItem, Button, Paper, Chip, IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

export default function AnnouncementsTab({ announcements = [], isEn, runAction }) {
  const [annForm, setAnnForm] = useState({
    titleTr: '',
    titleEn: '',
    contentTr: '',
    contentEn: '',
    priority: 'HIGH',
  });

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' }, gap: 3 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {isEn ? 'Publish New Announcement' : 'Yeni Duyuru Yayınla'}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Türkçe Başlık"
            size="small"
            fullWidth
            value={annForm.titleTr}
            onChange={(e) => setAnnForm({ ...annForm, titleTr: e.target.value })}
          />
          <TextField
            label="İngilizce Başlık (Opsiyonel)"
            size="small"
            fullWidth
            value={annForm.titleEn}
            onChange={(e) => setAnnForm({ ...annForm, titleEn: e.target.value })}
          />
          <TextField
            label="Türkçe İçerik"
            size="small"
            multiline
            rows={3}
            fullWidth
            value={annForm.contentTr}
            onChange={(e) => setAnnForm({ ...annForm, contentTr: e.target.value })}
          />
          <TextField
            label="İngilizce İçerik (Opsiyonel)"
            size="small"
            multiline
            rows={2}
            fullWidth
            value={annForm.contentEn}
            onChange={(e) => setAnnForm({ ...annForm, contentEn: e.target.value })}
          />
          <Select
            size="small"
            value={annForm.priority}
            onChange={(e) => setAnnForm({ ...annForm, priority: e.target.value })}
          >
            <MenuItem value="LOW">Düşük Öncelik (Bilgi)</MenuItem>
            <MenuItem value="MEDIUM">Normal Duyuru</MenuItem>
            <MenuItem value="HIGH">Önemli (Sabitlenmiş)</MenuItem>
            <MenuItem value="URGENT">Acil Uyarı</MenuItem>
          </Select>
          <Button
            variant="contained"
            onClick={() => {
              if (!annForm.titleTr || !annForm.contentTr) return;
              runAction('CREATE_ANNOUNCEMENT', annForm, 'Duyuru yayınlandı.');
              setAnnForm({ titleTr: '', titleEn: '', contentTr: '', contentEn: '', priority: 'HIGH' });
            }}
          >
            {isEn ? 'Publish Announcement' : 'Duyuruyu Yayınla'}
          </Button>
        </Box>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {isEn ? `Active Announcements (${announcements.length})` : `Aktif Duyurular (${announcements.length})`}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {announcements.map((a) => (
            <Paper
              key={a.id}
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 1,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={a.priority}
                    size="small"
                    color={a.priority === 'HIGH' || a.priority === 'URGENT' ? 'error' : 'primary'}
                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                  />
                  <Typography sx={{ fontWeight: 700 }}>
                    {isEn ? a.title?.en || a.title?.tr : a.title?.tr}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {isEn ? a.content?.en || a.content?.tr : a.content?.tr}
                </Typography>
              </Box>
              <IconButton
                color="error"
                size="small"
                onClick={() => runAction('DELETE_ANNOUNCEMENT', { id: a.id }, 'Duyuru silindi.')}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>
  );
}