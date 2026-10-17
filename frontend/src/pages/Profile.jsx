import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Container, Avatar, TextField, Button,
  CircularProgress, Alert, Snackbar, Chip, Divider,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import api from '../api';

import PersonIcon from '@mui/icons-material/Person';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import PhoneIcon from '@mui/icons-material/Phone';
import SchoolIcon from '@mui/icons-material/School';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function Profile() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { data: session, status: authStatus } = useSession();
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (authStatus === 'unauthenticated') { navigate('/'); return; }
    if (session?.user && !session.user.acceptedAgreementVersion) { navigate('/rules'); return; }

    api.get('/profile')
      .then((res) => {
        setProfile(res.data);
        setPhone(res.data.phone || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [authStatus, session, navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch('/profile', { phone: phone.trim() || null });
      setProfile(res.data);
      setSnack({ open: true, message: t('profileSaved'), severity: 'success' });
    } catch (err) {
      const msg = err.response?.data?.error || t('profileSaveError');
      setSnack({ open: true, message: msg, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Navbar />
        <Container sx={{ pt: 4 }}><Alert severity="error">{t('profileLoadError')}</Alert></Container>
      </Box>
    );
  }

  const initials = profile.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  const memberSince = new Date(profile.createdAt).toLocaleDateString(
    currentLang === 'tr' ? 'tr-TR' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const phoneIsMissing = !profile.phone;

  const infoRows = [
    { icon: <EmailIcon sx={{ fontSize: 18 }} />, label: t('profileEmail'), value: profile.email },
    { icon: <BadgeIcon sx={{ fontSize: 18 }} />, label: t('profileStudentNo'), value: profile.studentNumber || '—' },
    { icon: <SchoolIcon sx={{ fontSize: 18 }} />, label: t('profileDepartment'), value: profile.department || '—' },
    { icon: <PhoneIcon sx={{ fontSize: 18 }} />, label: t('profilePhone'), value: profile.phone || '—' },
    { icon: <CalendarTodayIcon sx={{ fontSize: 18 }} />, label: t('profileMemberSince'), value: memberSince },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}>
      <Navbar />

      <Container maxWidth="sm" sx={{ pt: 4 }}>
        {/* Profile Header Card */}
        <Card sx={{ overflow: 'hidden', mb: 3 }}>
          <Box sx={{
            height: 100, bgcolor: 'primary.main',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          }} />
          <Box sx={{ px: 3, pb: 3, mt: -5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 2 }}>
              <Avatar
                src={profile.avatarUrl}
                sx={{
                  width: 72, height: 72,
                  border: '3px solid', borderColor: 'background.paper',
                  bgcolor: 'primary.main', color: '#fff',
                  fontWeight: 700, fontSize: '1.3rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                }}
              >
                {initials}
              </Avatar>
              <Box sx={{ mb: 0.5 }}>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.3 }}>
                  {profile.fullName}
                </Typography>
                <Chip
                  label={profile.role}
                  size="small"
                  sx={{
                    mt: 0.5, height: 22, fontSize: '0.65rem', fontWeight: 700,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: 'primary.main',
                  }}
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Info Rows */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {infoRows.map((row) => (
                <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: 'text.disabled', display: 'flex', flexShrink: 0 }}>{row.icon}</Box>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', minWidth: 110, flexShrink: 0 }}>
                    {row.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>
                    {row.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Card>

        {/* Phone Alert + Form */}
        {phoneIsMissing && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            sx={{ mb: 3, borderRadius: 2 }}
          >
            {t('profilePhoneMissing')}
          </Alert>
        )}

        <Card sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
            {t('profileUpdatePhone')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5, fontSize: '0.8rem' }}>
            {t('profileUpdatePhoneDesc')}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+90 5XX XXX XX XX"
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <PhoneIcon sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }} />
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: '18px !important' }} />}
              sx={{ px: 3, borderRadius: 2, whiteSpace: 'nowrap', fontWeight: 600 }}
            >
              {t('profileSaveBtn')}
            </Button>
          </Box>
        </Card>
      </Container>

      <Footer />

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
