import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Button,
  Alert, Divider, LinearProgress
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PhonelinkLockIcon from '@mui/icons-material/PhonelinkLock';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import WifiIcon from '@mui/icons-material/Wifi';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import api from '../api';

const THKU_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png';

export default function KioskPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: session, status } = useSession();

  const doorParam = searchParams.get('door') || '';

  const [kioskData, setKioskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsCoords, setGpsCoords] = useState({ lat: null, lng: null, status: 'PENDING' });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isStaff = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role);

  const fetchKioskState = useCallback(async (latVal, lngVal) => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (doorParam) query.set('door', doorParam);
      if (typeof latVal === 'number' && typeof lngVal === 'number') {
        query.set('lat', String(latVal));
        query.set('lng', String(lngVal));
      }

      const res = await api.get(`/kiosk/qr?${query.toString()}`);
      setKioskData(res.data);
    } catch {
      setKioskData({ mode: 'ERROR', error: 'Yoklama verisi alınamadı.' });
    } finally {
      setLoading(false);
    }
  }, [doorParam]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      navigate('/');
      return;
    }

    if (isStaff) {
      fetchKioskState(null, null);
      return;
    }

    // Öğrenci ise tarayıcıdan GPS koordinatını iste ve sunucuya gönder
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setGpsCoords({ lat, lng, status: 'GRANTED' });
          fetchKioskState(lat, lng);
        },
        () => {
          setGpsCoords({ lat: null, lng: null, status: 'DENIED' });
          fetchKioskState(null, null);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    } else {
      setGpsCoords({ lat: null, lng: null, status: 'UNSUPPORTED' });
      fetchKioskState(null, null);
    }
  }, [status, isStaff, navigate, fetchKioskState]);

  const handleOneClickConfirm = async () => {
    if (!kioskData?.personalSessionToken) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/checkin/validate', {
        personalSessionToken: kioskData.personalSessionToken,
        lat: gpsCoords.lat,
        lng: gpsCoords.lng,
      });
      setFeedback({ type: 'success', text: res.data.message || 'Oda girişiniz başarıyla onaylandı!' });
      fetchKioskState(gpsCoords.lat, gpsCoords.lng);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Onay işlemi başarısız oldu.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', bgcolor: '#0F172A', gap: 2 }}>
        <CircularProgress sx={{ color: '#38BDF8' }} />
        <Typography variant="body2" sx={{ color: '#94A3B8' }}>
          Kapı QR, Kampüs Ağı ve GPS Konumu Doğrulanıyor...
        </Typography>
      </Box>
    );
  }

  // =========================================================================
  // MOD 1: GÖREVLİ / MÜDÜR EKRANI -> 4 ODAYA ASILACAK TEKİL KAPI QR POSTERİ
  // =========================================================================
  if (isStaff && kioskData?.mode === 'STAFF_POSTER') {
    const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(kioskData.doorQrUrl)}`;

    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#0F172A',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Card
          sx={{
            maxWidth: 580,
            width: '100%',
            p: { xs: 3, sm: 4.5 },
            borderRadius: 4,
            textAlign: 'center',
            bgcolor: '#1E293B',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1, '@media print': { display: 'none' } }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/admin')}
              sx={{ color: '#CBD5E1', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              Yönetim Paneline Dön
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
            >
              Kapı Posterini Yazdır (A4)
            </Button>
          </Box>

          <Box
            component="img"
            src={THKU_LOGO_URL}
            alt="THKÜ"
            sx={{ width: 76, height: 76, objectFit: 'contain', mx: 'auto', mb: 1.5, bgcolor: '#fff', p: 1, borderRadius: '50%' }}
          />

          <Chip
            icon={<QrCode2Icon sx={{ color: '#38BDF8 !important' }} />}
            label="THKÜ KÜTÜPHANE • 4 ODA ORTAK GİRİŞ QR KODU"
            sx={{ bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38BDF8', fontWeight: 700, mb: 1.5 }}
          />

          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
            Grup Çalışma Odaları (R101 – R104) Kapı Doğrulama Noktası
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8', mb: 3 }}>
            Randevu başlangıç saatinden <strong>±15 dakika içinde</strong> (Örn: 10:00 randevusu için 09:45 – 10:15 arası) her katılımcının kendi telefonundan bu QR kodu okutarak ekranda çıkan <strong>tek tıkla onay</strong> butonuna basması zorunludur.
          </Typography>

          <Box
            sx={{
              bgcolor: '#fff',
              p: 2.5,
              borderRadius: 3,
              display: 'inline-block',
              mb: 2.5,
              border: '4px solid #38BDF8',
            }}
          >
            <Box
              component="img"
              src={qrImageSrc}
              alt="THKÜ Ortak Kapı QR Kodu"
              sx={{ width: 240, height: 240, display: 'block' }}
            />
          </Box>

          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
            <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, display: 'block', mb: 0.5 }}>
              🛡️ AKTİF GÜVENLİK MİMARİSİ (KAPI QR + GPS + KAMPÜS WI-FI + CİHAZ KİLİDİ):
            </Typography>
            <Typography variant="caption" sx={{ color: '#CBD5E1', display: 'block', lineHeight: 1.6 }}>
              • Öğrenci anasayfasında Kiosk butonu bulunmaz; yalnızca bu QR kod okutulduğunda ekran açılır.<br />
              • Kampüs Wi-Fi (eduroam), Anti-VPN ve GPS konum doğrulaması sayesinde QR resmi dışarıdaki bir arkadaşa gönderilse bile uzaktan onay verilemez.<br />
              • Öğrencinin elle kod yazmasına gerek yoktur; ±15 dk içindeyse tek tıkla onaylar.
            </Typography>
          </Box>
        </Card>
      </Box>
    );
  }

  // =========================================================================
  // MOD 2: ÖĞRENCİ EKRANI -> KAPI QR OKUTULDUĞUNDA AÇILAN TEK TIKLA ONAY EKRANI
  // =========================================================================
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0F172A',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2.5,
      }}
    >
      <Card
        sx={{
          maxWidth: 500,
          width: '100%',
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          bgcolor: '#1E293B',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ color: '#CBD5E1', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Ana Sayfaya Dön
          </Button>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              icon={<WifiIcon sx={{ color: '#4ADE80 !important', fontSize: 15 }} />}
              label="Kampüs Ağı / Anti-VPN"
              size="small"
              sx={{ bgcolor: 'rgba(74,222,128,0.12)', color: '#4ADE80', fontWeight: 700, fontSize: '0.68rem' }}
            />
            <Chip
              icon={<MyLocationIcon sx={{ color: '#38BDF8 !important', fontSize: 15 }} />}
              label={gpsCoords.status === 'GRANTED' ? 'GPS Doğrulandı' : 'GPS Kontrolü'}
              size="small"
              sx={{ bgcolor: 'rgba(56,189,248,0.15)', color: '#38BDF8', fontWeight: 700, fontSize: '0.68rem' }}
            />
          </Box>
        </Box>

        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src={THKU_LOGO_URL}
            alt="THKÜ"
            sx={{ width: 64, height: 64, objectFit: 'contain', mx: 'auto', mb: 1, bgcolor: '#fff', p: 0.75, borderRadius: '50%' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Kapı QR Yoklama & Oda Giriş Onayı
          </Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            {session?.user?.name} ({session?.user?.email})
          </Typography>
        </Box>

        {kioskData?.mode === 'DOOR_QR_REQUIRED' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {kioskData.error}
            </Alert>
            {import.meta.env.DEV && (
              <Button
                variant="outlined"
                color="info"
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={() => navigate('/kiosk?door=thku-study-room')}
              >
                [Geliştirici Testi] Kapı QR Okutulmuş Gibi Aç (?door=thku-study-room)
              </Button>
            )}
          </Box>
        ) : kioskData?.mode === 'LOCATION_BLOCKED' ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>
            {kioskData.error}
          </Alert>
        ) : kioskData?.mode === 'OUTSIDE_TIME_WINDOW' || kioskData?.mode === 'STUDENT_NO_ACTIVE_BOOKING' ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            {kioskData.error}
          </Alert>
        ) : kioskData?.mode === 'STUDENT_ACTIVE' ? (
          <>
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#0F172A', mb: 2.5, border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 800, color: '#38BDF8', fontSize: '1.05rem' }}>
                  {kioskData.room?.roomNumber} - {kioskData.room?.name}
                </Typography>
                <Chip
                  label={`${kioskData.checkedCount} / ${kioskData.totalCount} Kişi Onayladı`}
                  size="small"
                  color={kioskData.checkedCount === kioskData.totalCount ? 'success' : 'warning'}
                  sx={{ fontWeight: 700 }}
                />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, color: '#FBBF24' }}>
                <AccessTimeIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Geçerli Onay Penceresi (±15 Dk): {kioskData.windowLabel}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={(kioskData.checkedCount / Math.max(1, kioskData.totalCount)) * 100}
                sx={{ height: 8, borderRadius: 4, mb: 1.5 }}
              />

              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1 }}>
                Grup Üyeleri Yoklama Durumu (Herkesin kendi telefonundan onaylaması zorunludur):
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {kioskData.members?.map((m) => (
                  <Box key={m.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#E2E8F0', fontSize: '0.82rem' }}>
                      {m.fullName} ({m.role})
                    </Typography>
                    <Chip
                      label={m.hasCheckedIn ? 'Onayladı ✓' : 'Bekleniyor...'}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        bgcolor: m.hasCheckedIn ? alpha(theme.palette.success.main, 0.2) : 'rgba(255,255,255,0.08)',
                        color: m.hasCheckedIn ? '#4ADE80' : '#FBBF24',
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>

            {feedback && (
              <Alert severity={feedback.type} sx={{ mb: 2, borderRadius: 2 }}>
                {feedback.text}
              </Alert>
            )}

            {kioskData.alreadyCheckedIn ? (
              <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success" sx={{ borderRadius: 2, fontWeight: 600 }}>
                Bu randevu için kapı QR giriş onayınızı tamamladınız! İyi çalışmalar dileriz.
              </Alert>
            ) : (
              <>
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: 'rgba(74, 222, 128, 0.08)',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    textAlign: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#E2E8F0', fontWeight: 600, mb: 2 }}>
                    Kapı QR kodunuz ve ±15 dakikalık randevu zaman diliminiz doğrulandı. Oda kullanımınızı başlatmak için aşağıdaki butona tıklayınız:
                  </Typography>

                  <Button
                    fullWidth
                    size="large"
                    variant="contained"
                    color="success"
                    disabled={submitting}
                    onClick={handleOneClickConfirm}
                    startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <VerifiedUserIcon />}
                    sx={{
                      py: 1.6,
                      fontWeight: 800,
                      fontSize: '1rem',
                      borderRadius: 2.5,
                      boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.5)',
                    }}
                  >
                    {submitting ? 'Onaylanıyor...' : 'Oda Girişimi Onayla (Check-In)'}
                  </Button>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, color: '#64748B' }}>
                  <PhonelinkLockIcon sx={{ fontSize: 15 }} />
                  <Typography variant="caption" sx={{ textAlign: 'center' }}>
                    Cihaz kilidi aktiftir: Bu telefondan başka bir öğrencinin hesabına girilerek onay verilemez.
                  </Typography>
                </Box>
              </>
            )}
          </>
        ) : (
          <Alert severity="error">{kioskData?.error || 'Beklenmeyen bir hata oluştu.'}</Alert>
        )}
      </Card>
    </Box>
  );
}