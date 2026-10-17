import { useEffect, useState } from 'react';
import { Box, Card, Typography, CircularProgress, LinearProgress } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import api from '../api';

export default function Kiosk() {
  const [data, setData] = useState({ token: '------', expiresIn: 30 });
  const [loading, setLoading] = useState(true);

  const fetchToken = async () => {
    try {
      const res = await api.get('/kiosk/qr');
      setData(res.data);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
    const interval = setInterval(() => {
      setData((prev) => {
        if (prev.expiresIn <= 1) {
          fetchToken();
          return prev;
        }
        return { ...prev, expiresIn: prev.expiresIn - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Card sx={{ maxWidth: 460, width: '100%', p: 5, textAlign: 'center' }}>
        <QrCode2Icon sx={{ fontSize: 64, color: 'primary.main', mb: 1 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          THKÜ Kütüphane Kiosk Check-In
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          Oda rezervasyonunuzu başlatmak için aşağıdaki 6 haneli kodu öğrenci panelinizdeki Check-In ekranına giriniz.
        </Typography>

        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <Box sx={{ py: 3, px: 2, bgcolor: 'action.hover', borderRadius: 3, border: '2px dashed', borderColor: 'primary.main', mb: 3 }}>
              <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: '0.25em', color: 'primary.main' }}>
                {data.token}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={(data.expiresIn / 30) * 100}
              sx={{ height: 8, borderRadius: 4, mb: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Yeni kod için kalan süre: {data.expiresIn} saniye
            </Typography>
          </>
        )}
      </Card>
    </Box>
  );
}