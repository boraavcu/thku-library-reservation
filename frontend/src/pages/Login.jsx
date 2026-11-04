import React, { useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  IconButton,
  TextField,
  Tooltip,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import WindowIcon from '@mui/icons-material/Window';
import LanguageIcon from '@mui/icons-material/Language';
import SchoolIcon from '@mui/icons-material/School';
import BadgeIcon from '@mui/icons-material/Badge';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useTranslation } from 'react-i18next';
import { alpha } from '@mui/material/styles';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'react-router-dom';
import PasswordField from '../components/PasswordField';
import { appAbsoluteUrl, appPath, stripAppBase } from '../runtimePaths';

const DEMO_ACCOUNTS = [
  {
    label: 'Öğrenci 1 (Bora Avcu)',
    subLabel: 's250444902@stu.thk.edu.tr',
    email: 's250444902@stu.thk.edu.tr',
    icon: <SchoolIcon fontSize="small" />,
    color: 'primary',
  },
  {
    label: 'Öğrenci 2 (Ayşe Yılmaz - Demo)',
    subLabel: 'demo.ogrenci2.x91@demo.local',
    email: 'demo.ogrenci2.x91@demo.local',
    icon: <SchoolIcon fontSize="small" />,
    color: 'info',
  },
  {
    label: 'Öğrenci 3 (Mehmet Demir - Demo)',
    subLabel: 'demo.ogrenci3.k42@demo.local',
    email: 'demo.ogrenci3.k42@demo.local',
    icon: <SchoolIcon fontSize="small" />,
    color: 'primary',
  },
  {
    label: 'Öğrenci 4 (Zeynep Kaya - Demo)',
    subLabel: 'demo.ogrenci4.m18@demo.local',
    email: 'demo.ogrenci4.m18@demo.local',
    icon: <SchoolIcon fontSize="small" />,
    color: 'primary',
  },
  {
    label: 'Öğrenci 5 (Caner Aydın - Sınırda)',
    subLabel: 'demo.ogrenci5.p77@demo.local',
    email: 'demo.ogrenci5.p77@demo.local',
    icon: <SchoolIcon fontSize="small" />,
    color: 'primary',
  },
  {
    label: 'Öğrenci 6 (Elif Şahin - Demo)',
    subLabel: 'demo.ogrenci6.r33@demo.local',
    email: 'demo.ogrenci6.r33@demo.local',
    icon: <SchoolIcon fontSize="small" />,
    color: 'primary',
  },
  {
    label: 'Öğrenci 7 (Burak Çelik - Demo)',
    subLabel: 'demo.ogrenci7.t55@demo.local',
    email: 'demo.ogrenci7.t55@demo.local',
    icon: <SchoolIcon fontSize="small" />,
    color: 'primary',
  },
  {
    label: 'Kütüphane Görevlisi (LIBRARIAN)',
    subLabel: 'gorevli.demo@demo.local',
    email: 'gorevli.demo@demo.local',
    icon: <BadgeIcon fontSize="small" />,
    color: 'success',
  },
  {
    label: 'Kütüphane Müdürü (ADMIN)',
    subLabel: 'boraa-35@hotmail.com',
    email: 'boraa-35@hotmail.com',
    icon: <AdminPanelSettingsIcon fontSize="small" />,
    color: 'warning',
  },
  {
    label: 'BİM Sistem Yöneticisi (SUPER_ADMIN)',
    subLabel: 'bim.demo@demo.local',
    email: 'bim.demo@demo.local',
    icon: <AdminPanelSettingsIcon fontSize="small" />,
    color: 'error',
  },
];

const isDemoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN !== 'false';

function getPostLoginTargetPath() {
  try {
    const returnDoor = sessionStorage.getItem('thku_kiosk_return_door');
    if (returnDoor) {
      return `/kiosk?door=${encodeURIComponent(returnDoor)}`;
    }
  } catch {
    // ignore storage errors
  }
  return '/dashboard';
}

const Login = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');
  const [loadingEmail, setLoadingEmail] = useState(null);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');

  const toggleLanguage = () => {
    const newLang = i18n.language === 'tr' ? 'en' : 'tr';
    i18n.changeLanguage(newLang);
  };

  const handleDemoLogin = async (email) => {
    setStaffError('');
    setLoadingEmail(email);
    try {
      const targetPath = getPostLoginTargetPath();
      const res = await signIn('demo-login', {
        email,
        redirect: false,
        callbackUrl: appAbsoluteUrl(targetPath),
      });
      if (res?.error) {
        setStaffError(
          i18n.language?.startsWith('en')
            ? 'Sign-in failed or database server is unreachable.'
            : 'Giriş yapılamadı veya veritabanı sunucusuna bağlanılamadı.'
        );
        return;
      }
      if (res?.ok) {
        window.location.assign(appPath(targetPath));
      }
    } finally {
      setLoadingEmail(null);
    }
  };

  const handleStaffPasswordLogin = async (e) => {
    e.preventDefault();
    setStaffError('');
    const em = staffEmail.trim().toLowerCase();
    if (!em.endsWith('@thk.edu.tr') || em.endsWith('@stu.thk.edu.tr')) {
      setStaffError(
        i18n.language?.startsWith('en')
          ? 'Only institutional @thk.edu.tr addresses may use password sign-in.'
          : 'Şifre ile giriş yalnızca kurumsal @thk.edu.tr adresleri içindir.'
      );
      return;
    }
    setStaffLoading(true);
    try {
      const targetPath = getPostLoginTargetPath();
      const res = await signIn('staff-login', {
        email: em,
        password: staffPassword,
        redirect: false,
        callbackUrl: appAbsoluteUrl(targetPath),
      });
      if (res?.error) {
        if (res.error === 'RATE_LIMITED' || res.error === 'CokFazlaDeneme') {
          setStaffError(
            i18n.language?.startsWith('en')
              ? 'Too many attempts. Please wait a few minutes and try again.'
              : 'Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.'
          );
          return;
        }
        if (res.error === 'SERVICE_UNAVAILABLE' || res.error === 'GirisServis') {
          setStaffError(
            i18n.language?.startsWith('en')
              ? 'Sign-in service is temporarily unavailable. Check server database logs.'
              : 'Giriş servisi geçici olarak kullanılamıyor. Veritabanı bağlantısını kontrol edin.'
          );
          return;
        }
        setStaffError(
          i18n.language?.startsWith('en')
            ? 'Invalid email or password, or password login is not enabled for this account (temporary password may have expired).'
            : 'E-posta veya şifre hatalı; ya da bu hesap için şifre girişi tanımlı değil / geçici şifrenin süresi dolmuş.'
        );
        return;
      }
      if (res?.ok) {
        const dest = res.url
          ? stripAppBase(new URL(res.url, window.location.origin).pathname + new URL(res.url, window.location.origin).search) || targetPath
          : targetPath;
        window.location.assign(appPath(dest));
      }
    } finally {
      setStaffLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: { xs: 2, sm: 4 },
        position: 'relative',
      }}
    >
      <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
        <Tooltip title={i18n.language === 'tr' ? 'Switch to English' : "Türkçe'ye Geç"}>
          <IconButton onClick={toggleLanguage} color="primary">
            <LanguageIcon />
            <Typography variant="button" sx={{ ml: 0.5, fontWeight: 'bold' }}>
              {i18n.language.toUpperCase()}
            </Typography>
          </IconButton>
        </Tooltip>
      </Box>

      <Card
        elevation={0}
        sx={{
          maxWidth: 460,
          width: '100%',
          borderRadius: 3,
          position: 'relative',
          overflow: 'visible',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          mt: 4,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 6,
            bgcolor: 'primary.main',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        />

        <CardContent
          sx={{
            p: { xs: 3, sm: 4.5 },
            pt: { xs: 6, sm: 6 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: -8, mb: 0.5 }}>
            <Box
              sx={{
                width: 110,
                height: 110,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                border: '4px solid',
                borderColor: 'background.paper',
                outline: '2px solid',
                outlineColor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: (theme) => `0px 10px 25px ${alpha(theme.palette.primary.main, 0.25)}`,
                zIndex: 10,
              }}
            >
              <Avatar
                src="https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png"
                alt="THK Logo"
                sx={{ width: 85, height: 85 }}
                imgProps={{ style: { objectFit: 'contain' } }}
              />
            </Box>
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
              {t('universityName')}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 500, color: 'text.primary', opacity: 0.9, lineHeight: 1.3 }}>
              {t('systemName')}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
              {t('secureAccess')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {oauthError && !staffError && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                {i18n.language?.startsWith('en')
                  ? 'Microsoft SSO (Azure AD) credentials are not configured in local test mode. Please use Demo Quick Login or Staff Password below.'
                  : 'Yerel test ortamında Microsoft (Azure AD) anahtarları tanımlı olmadığı için SSO başlatılamadı. Lütfen aşağıdaki Demo Hızlı Giriş veya Personel Şifre girişini kullanınız.'}
              </Alert>
            )}
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<WindowIcon sx={{ fontSize: 26 }} />}
              onClick={() =>
                signIn('azure-ad', {
                  callbackUrl: appAbsoluteUrl(getPostLoginTargetPath()),
                })
              }
              sx={{
                py: 1.5,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              {t('signInMicrosoft')}
            </Button>

            <Typography variant="caption" align="center" sx={{ color: 'text.secondary' }}>
              {t('onlyInstitutional')}
            </Typography>
          </Box>

          <Divider sx={{ my: 0.5 }}>
            <Chip
              label={
                i18n.language?.startsWith('en')
                  ? 'INSTITUTIONAL STAFF (@thk.edu.tr)'
                  : 'KURUMSAL PERSONEL (@thk.edu.tr)'
              }
              size="small"
              sx={{ fontSize: '0.65rem', fontWeight: 700, bgcolor: 'action.hover', color: 'text.secondary' }}
            />
          </Divider>

          <Box component="form" onSubmit={handleStaffPasswordLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {staffError && (
              <Alert severity="error" sx={{ py: 0.5 }}>
                {staffError}
              </Alert>
            )}
            <TextField
              size="small"
              fullWidth
              label={i18n.language?.startsWith('en') ? 'Email (@thk.edu.tr)' : 'E-posta (@thk.edu.tr)'}
              type="email"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              autoComplete="username"
            />
            <PasswordField
              size="small"
              fullWidth
              label={i18n.language?.startsWith('en') ? 'Password' : 'Şifre'}
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="outlined"
              fullWidth
              disabled={staffLoading || !staffEmail.trim() || !staffPassword}
              sx={{ py: 1.1, fontWeight: 700, textTransform: 'none' }}
            >
              {staffLoading ? (
                <CircularProgress size={22} />
              ) : i18n.language?.startsWith('en') ? (
                'Sign in with password'
              ) : (
                'Şifre ile giriş yap'
              )}
            </Button>
          </Box>

          {isDemoLoginEnabled && (
            <>
              <Divider sx={{ my: 0.5 }}>
                <Chip
                  label="DEMO HIZLI GİRİŞ (GÜVENLİ MAİL MODU)"
                  size="small"
                  sx={{ fontSize: '0.65rem', fontWeight: 700, bgcolor: 'action.hover', color: 'primary.main' }}
                />
              </Divider>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
                {DEMO_ACCOUNTS.map((acc) => {
                  const isBusy = loadingEmail === acc.email;
                  return (
                    <Button
                      key={acc.email}
                      variant="outlined"
                      color={acc.color}
                      disabled={Boolean(loadingEmail)}
                      onClick={() => handleDemoLogin(acc.email)}
                      startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : acc.icon}
                      sx={{
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                        py: 1,
                        px: 1.5,
                        borderRadius: 2,
                        borderColor: 'divider',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ overflow: 'hidden' }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }} noWrap>
                          {acc.label}
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }} noWrap>
                          {acc.subLabel}
                        </Typography>
                      </Box>
                    </Button>
                  );
                })}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      <Box component="footer" sx={{ mt: 4, textAlign: 'center', px: 2 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('footerRights')}
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
