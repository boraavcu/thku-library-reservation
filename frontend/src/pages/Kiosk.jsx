import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Chip, CircularProgress, Button, TextField,
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
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../api';
import thkuLogo from '../assets/thku-logo.png';

export default function KioskPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { data: session, status } = useSession();

  const [kioskData, setKioskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [inputCode, setInputCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const isStaff = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role);

  const fetchKioskState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/kiosk/qr');
      setKioskData(res.data);
      if (res.data?.ttl) {
        setTimeLeft(res.data.ttl);
      }
      if (res.data?.personalCode) {
        setInputCode(res.data.personalCode);
      }
    } catch {
      setKioskData({ mode: 'ERROR', error: 'Kiosk verisi alınamadı.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      navigate('/');
      return;
    }
    fetchKioskState();
  }, [status, navigate, fetchKioskState]);

  // 10 Dakikalık (600 sn) geri sayım sayacı
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleStudentVerify = async () => {
    if (!inputCode.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await api.post('/checkin/validate', { token: inputCode.trim() });
      setFeedback({ type: 'success', text: res.data.message || 'Girişiniz başarıyla doğrulandı!' });
      fetchKioskState();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Doğrulama başarısız oldu.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fmtSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (status === 'loading' || loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#0F172A' }}>
        <CircularProgress sx={{ color: '#fff' }} />
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
            maxWidth: 560,
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, '@media print': { display: 'none' } }}>
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
            src={thkuLogo}
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
            Odaya girişte gruptaki <strong>her öğrencinin</strong> kendi mobil cihazından bu QR kodu okutarak kendisine özel üretilen <strong>10 dakika geçerli kodu</strong> onaylaması zorunludur.
          </Typography>

          {/* Ortak Tekil QR Kod */}
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
              🛡️ AKTİF GÜVENLİK KURALLARI (MADDE 1 & 15):
            </Typography>
            <Typography variant="caption" sx={{ color: '#CBD5E1', display: 'block', lineHeight: 1.6 }}>
              • Bu tekil QR kod 4 çalışma odasının (Atatürk, Gökçen, Uçantürk, İstikbal) girişine asılır.<br />
              • QR okutulduğunda her öğrenciye <strong>birbirinden farklı ve 10 dakika geçerli kişisel kod</strong> üretilir.<br />
              • <strong>Cihaz Kilidi Aktiftir:</strong> Bir telefondan başka bir öğrencinin hesabına girilerek onun yerine onay yapılamaz.
            </Typography>
          </Box>
        </Card>
      </Box>
    );
  }

  // =========================================================================
  // MOD 2: ÖĞRENCİ EKRANI -> KAPI QR OKUTULDUĞUNDA AÇILAN KİŞİSEL KOD EKRANI
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/dashboard')}
            sx={{ color: '#CBD5E1', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Ana Sayfaya Dön
          </Button>
          <Chip
            icon={<PhonelinkLockIcon sx={{ color: '#38BDF8 !important' }} />}
            label="Cihaz Kilidi Aktif"
            size="small"
            sx={{ bgcolor: 'rgba(56,189,248,0.15)', color: '#38BDF8', fontWeight: 700 }}
          />
        </Box>

        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            component="img"
            src={thkuLogo}
            alt="THKÜ"
            sx={{ width: 64, height: 64, objectFit: 'contain', mx: 'auto', mb: 1, bgcolor: '#fff', p: 0.75, borderRadius: '50%' }}
          />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Kapı QR Yoklama & Kişisel Kod Doğrulama
          </Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            {session?.user?.name} ({session?.user?.email})
          </Typography>
        </Box>

        {kioskData?.mode === 'STUDENT_NO_ACTIVE_BOOKING' ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            {kioskData.error}
          </Alert>
        ) : kioskData?.mode === 'STUDENT_ACTIVE' ? (
          <>
            {/* Oda ve Grup Yoklama Durumu */}
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#0F172A', mb: 2.5, border: '1px solid rgba(255,255,255,0.08)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography sx={{ fontWeight: 700, color: '#38BDF8' }}>
                  {kioskData.room?.roomNumber} - {kioskData.room?.name}
                </Typography>
                <Chip
                  label={`${kioskData.checkedCount} / ${kioskData.totalCount} Kişi Onayladı`}
                  size="small"
                  color={kioskData.checkedCount === kioskData.totalCount ? 'success' : 'warning'}
                  sx={{ fontWeight: 700 }}
                />
              </Box>
              <LinearProgress
                variant="determinate"
                value={(kioskData.checkedCount / Math.max(1, kioskData.totalCount)) * 100}
                sx={{ height: 8, borderRadius: 4, mb: 1.5 }}
              />

              <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1 }}>
                Grup Üyeleri Yoklama Durumu (Herkesin girmesi zorunludur):
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {kioskData.members?.map((m) => (
                  <Box key={m.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <Typography variant="body2" sx={{ color: '#E2E8F0', fontSize: '0.8rem' }}>
                      {m.fullName} ({m.role})
                    </Typography>
                    <Chip
                      label={m.hasCheckedIn ? 'Giriş Yaptı ✓' : 'Bekleniyor...'}
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

            {kioskData.alreadyCheckedIn ? (
              <Alert icon={<CheckCircleIcon fontSize="inherit" />} severity="success" sx={{ borderRadius: 2, fontWeight: 600 }}>
                Bu randevu için kişisel kapı doğrulamanızı tamamladınız! İyi çalışmalar dileriz.
              </Alert>
            ) : (
              <>
                {/* Kişiye Özel 10 Dakikalık Kod Kutusu */}
                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: 'rgba(56, 189, 248, 0.08)',
                    border: '2px dashed #38BDF8',
                    textAlign: 'center',
                    mb: 2.5,
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#38BDF8', fontWeight: 700, letterSpacing: '0.08em' }}>
                    SİZE ÖZEL ÜRETİLEN KİŞİSEL KODUNUZ (10 DK GEÇERLİ)
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '2.4rem',
                      fontWeight: 900,
                      letterSpacing: '0.22em',
                      fontFamily: 'monospace',
                      color: '#fff',
                      my: 1,
                    }}
                  >
                    {kioskData.personalCode || '------'}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                    <AccessTimeIcon sx={{ fontSize: 16, color: '#FBBF24' }} />
                    <Typography variant="caption" sx={{ color: '#FBBF24', fontWeight: 700 }}>
                      Kalan Geçerlilik Süresi: {fmtSeconds(timeLeft)}
                    </Typography>
                    {timeLeft === 0 && (
                      <Button size="small" startIcon={<RefreshIcon />} onClick={fetchKioskState} sx={{ color: '#38BDF8' }}>
                        Yeni Kod Üret
                      </Button>
                    )}
                  </Box>
                </Box>

                {feedback && (
                  <Alert severity={feedback.type} sx={{ mb: 2, borderRadius: 2 }}>
                    {feedback.text}
                  </Alert>
                )}

                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <TextField
                    fullWidth
                    size="small"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="6 Haneli Kişisel Kodunuz"
                    inputProps={{
                      maxLength: 6,
                      style: {
                        color: '#fff',
                        fontWeight: 800,
                        letterSpacing: '0.2em',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                      },
                    }}
                    sx={{
                      bgcolor: '#0F172A',
                      borderRadius: 2,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    }}
                  />
                  <Button
                    variant="contained"
                    color="success"
                    disabled={submitting || inputCode.trim().length < 6}
                    onClick={handleStudentVerify}
                    startIcon={<VerifiedUserIcon />}
                    sx={{ px: 3, fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    {submitting ? <CircularProgress size={20} color="inherit" /> : 'Onayla'}
                  </Button>
                </Box>

                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.08)' }} />
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block', textAlign: 'center' }}>
                  Not: Cihaz kilidi nedeniyle bu telefondan başka bir öğrencinin hesabına girilerek onaylama yapılamaz.
                </Typography>
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