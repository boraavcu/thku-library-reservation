import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Avatar, Container, Paper, Checkbox, Button, Stack,
  IconButton, Tooltip, CircularProgress, Alert
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from 'react-i18next';
import { useSession, signOut } from "next-auth/react";
import api from '../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Footer from '../components/Footer';

const THKU_LOGO = "https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png";

const ENGLISH_RULES = [
  {
    id: 1,
    title: "Maximum Reservation Duration & Daily Limit",
    desc: "Study rooms can be reserved only once (1) per day for a maximum of 3 hours. Extensions are not permitted. Users who book between 21:00–24:00 cannot book between 00:00–08:00 the following day.",
  },
  {
    id: 2,
    title: "Door QR Code, Personal Check-In & No-Show Policy",
    desc: "At least 2 group members must scan the door QR code from their own mobile devices (connected to Campus Wi-Fi & GPS) within ±15 minutes of the start time to confirm check-in. Reservations cannot be cancelled within 1 hour of the start time. Users who fail to check in receive a No-Show warning (1/3); 3 warnings result in a 30-day reservation ban.",
  },
  {
    id: 3,
    title: "Silence and Usage Rules",
    desc: "Users must maintain a quiet academic environment. Loud conversations, music without headphones, or disruptive behavior are not permitted. Food and beverages (except water in a closed bottle) are strictly prohibited.",
  },
  {
    id: 4,
    title: "Equipment Responsibility",
    desc: "Users are responsible for any damage caused to library property, furniture, or technical equipment during their reservation. Do not unplug library equipment and report any existing issues immediately upon entering.",
  },
  {
    id: 5,
    title: "Group Study & 30-Minute Invitation Timeout",
    desc: "Study rooms are designed for group study (minimum 2 participants, maximum 8 capacity). Group invitations must be accepted within 30 minutes; otherwise, the reservation is automatically cancelled.",
  },
  {
    id: 6,
    title: "Advance Booking Window & Early Check-Out",
    desc: "Reservations can be made up to 1 day in advance. Groups that finish early can use the 'Early Check-Out' button during their session to free the remaining time for other students.",
  },
];

function parseRules(content) {
  if (!content) return [];
  const blocks = content.split(/\n(?=\d+\.\s)/).filter(Boolean);
  return blocks.map((block) => {
    const match = block.match(/^(\d+)\.\s+(.+?)(?:\n)([\s\S]*)$/);
    if (!match) return null;
    return { id: parseInt(match[1], 10), title: match[2].trim(), desc: match[3].trim() };
  }).filter(Boolean);
}

const RulesAcceptance = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('view') === 'true';
  const { data: session, status, update } = useSession();

  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [agreement, setAgreement] = useState(null);
  const [agreementLoading, setAgreementLoading] = useState(true);
  const [agreementError, setAgreementError] = useState(null);

  const isStaff = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'].includes(session?.user?.role);
  const homePath = isStaff ? '/admin' : '/dashboard';

  const rules = useMemo(() => {
    if (isEn) return ENGLISH_RULES;
    return parseRules(agreement?.content);
  }, [agreement, isEn]);

  const alreadyAccepted = Boolean(
    agreement &&
    session?.user?.acceptedAgreementVersion &&
    session.user.acceptedAgreementVersion === agreement.version
  );

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      navigate('/');
      return;
    }

    api.get('/agreements/active')
      .then(res => {
        setAgreement(res.data);
        setAgreementLoading(false);
      })
      .catch(err => {
        const msg = err.response?.status === 404
          ? t('agreementNotFound')
          : t('agreementError');
        setAgreementError(msg);
        setAgreementLoading(false);
      });
  }, [status, navigate, t]);

  const handleContinue = async () => {
    if (!accepted || !agreement) return;
    setSubmitting(true);
    try {
      const res = await api.post('/user/accept-rules');
      await update({ acceptedAgreementVersion: res.data.acceptedVersion });
      window.location.href = homePath;
    } catch (error) {
      console.error("Sözleşme kabul hatası:", error);
      alert(t('agreementError'));
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: `${window.location.origin}/` });
  };

  const toggleLanguage = () => {
    const newLang = isEn ? 'tr' : 'en';
    i18n.changeLanguage(newLang);
  };

  if (status === "loading") {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <Paper elevation={0} sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100, borderBottom: '1px solid', borderColor: 'divider', px: { xs: 2, md: 4 }, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: alreadyAccepted ? 'pointer' : 'default' }} onClick={() => alreadyAccepted && navigate(homePath)}>
          <Avatar
            src={THKU_LOGO}
            alt="THKÜ Logo"
            sx={{ width: 42, height: 42, bgcolor: 'background.paper', p: 0.25, border: '1px solid', borderColor: 'divider' }}
            imgProps={{ style: { objectFit: 'contain' } }}
          />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{t('universityName')}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>{t('systemName')}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={isEn ? "Türkçe'ye Geç" : "Switch to English"}>
            <IconButton onClick={toggleLanguage} color="primary" size="small">
              <LanguageIcon fontSize="small" />
              <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 'bold' }}>{isEn ? 'EN' : 'TR'}</Typography>
            </IconButton>
          </Tooltip>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
            <Avatar src={session?.user?.image} alt={session?.user?.name || "User"} sx={{ width: 32, height: 32, bgcolor: 'primary.main' }} />
            <Typography variant="body2" fontWeight={600}>{session?.user?.name}</Typography>
          </Box>
        </Box>
      </Paper>

      <Box sx={{ flexGrow: 1, pt: { xs: '100px', md: '100px' }, pb: { xs: '180px', md: '150px' } }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 4, lg: 8 } }}>
          {agreementLoading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 8 }}>
              <CircularProgress />
              <Typography variant="body1" color="text.secondary">{t('agreementLoading')}</Typography>
            </Box>
          )}

          {agreementError && (
            <Alert severity="error" sx={{ mt: 4, maxWidth: 600, mx: 'auto' }}>{agreementError}</Alert>
          )}

          {agreement && !agreementLoading && (
            <>
              <Box sx={{ textAlign: 'center', mb: 6, maxWidth: '800px', mx: 'auto' }}>
                <Typography variant="h3" component="h1" sx={{ fontWeight: 900, mb: 2, fontSize: { xs: '1.75rem', md: '2.75rem' } }}>
                  {isEn ? t('rulesTitle') : agreement.title}
                </Typography>
                <Typography variant="h6" sx={{ color: 'text.secondary', fontWeight: 400, lineHeight: 1.6 }}>
                  {t('rulesSubtitle')}
                </Typography>
              </Box>

              <Stack spacing={4} sx={{ maxWidth: '900px', mx: 'auto', mb: 6 }}>
                {rules.map((rule) => (
                  <Box key={rule.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{
                        width: 44, height: 44, flexShrink: 0, borderRadius: '50%',
                        bgcolor: 'primary.light',
                        color: 'primary.main',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '1.2rem',
                      }}>
                        {rule.id}
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, fontSize: { xs: '1.15rem', md: '1.4rem' } }}>
                        {rule.title}
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ pl: { xs: 0, sm: '60px' }, color: 'text.secondary', fontSize: '1.05rem', lineHeight: 1.6 }}>
                      {rule.desc}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              <Footer />
            </>
          )}
        </Container>
      </Box>

      {agreement && !agreementLoading && (
        <Paper elevation={0} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100, borderTop: '1px solid', borderColor: 'divider', p: { xs: 2.5, md: 3 }, bgcolor: 'background.paper' }}>
          <Container maxWidth="md">
            {alreadyAccepted || isViewMode ? (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                  {isEn
                    ? `✓ You have accepted this agreement (${agreement.version}).`
                    : `✓ Bu sözleşmeyi (${agreement.version}) onayladınız.`}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => navigate(homePath)}
                >
                  {isStaff ? (isEn ? 'Back to Management Center' : 'Yönetim Merkezine Dön') : t('navDashboard')}
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} sx={{ mt: -0.5 }} disabled={submitting} />
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', cursor: 'pointer' }} onClick={() => !submitting && setAccepted(!accepted)}>{t('iRead')}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>{t('byContinuing')}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 2 }}>
                  <Button variant="outlined" size="large" color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout} disabled={submitting} sx={{ flex: { sm: '0 0 auto' }, borderColor: 'divider', color: 'text.primary' }}>{t('logout')}</Button>
                  <Button variant="contained" size="large" fullWidth disabled={!accepted || submitting} onClick={handleContinue} endIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <ArrowForwardIcon />} sx={{ py: 1.5, fontSize: '1rem' }}>{submitting ? (isEn ? "Processing..." : "İşleniyor...") : t('continueBtn')}</Button>
                </Box>
              </Box>
            )}
          </Container>
        </Paper>
      )}
    </Box>
  );
};

export default RulesAcceptance;