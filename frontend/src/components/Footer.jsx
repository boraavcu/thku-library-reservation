import { Box, Container, Typography, Avatar, Chip, Stack, Divider, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const THKU_LOGO = "https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png";
const DEVELOPER_LINKEDIN = "https://www.linkedin.com/in/bora-avcu-b75a26204/";

export default function Footer() {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn = i18n.language?.startsWith('en');

  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        py: 3,
        px: 2,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          {/* Sol: THKÜ Logo ve Kurumsal Bilgi */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              src={THKU_LOGO}
              alt="THKÜ Logo"
              sx={{
                width: 36,
                height: 36,
                bgcolor: 'background.paper',
                p: 0.25,
                border: '1px solid',
                borderColor: 'divider',
              }}
              imgProps={{ style: { objectFit: 'contain' } }}
            />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.2 }}>
                {isEn
                  ? 'University of Turkish Aeronautical Association'
                  : 'Türk Hava Kurumu Üniversitesi'}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                {isEn
                  ? '© 2026 All Rights Reserved • IT Department (THKÜ BİM)'
                  : '© 2026 Tüm Hakları Saklıdır • Bilgi İşlem Müdürlüğü (THKÜ BİM)'}
              </Typography>
            </Box>
          </Box>

          {/* Orta: Hızlı Bağlantılar */}
          <Stack direction="row" spacing={2.5} divider={<Divider orientation="vertical" flexItem />}>
            <Typography
              onClick={() => navigate('/rules?view=true')}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'text.secondary',
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
              }}
            >
              {isEn ? 'Terms of Use & Rules' : 'Kullanım Kuralları'}
            </Typography>
            <Typography
              onClick={() => navigate('/dashboard')}
              sx={{
                fontSize: '0.75rem',
                fontWeight: 500,
                color: 'text.secondary',
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' },
              }}
            >
              {isEn ? 'Study Room Portal' : 'Çalışma Odası Portalı'}
            </Typography>
          </Stack>

          {/* Sağ: Developer İmza Rozeti (LinkedIn Profil Yönlendirmeli) */}
          <Tooltip title={isEn ? 'View Bora Avcu on LinkedIn' : 'Bora Avcu LinkedIn Profilini Görüntüle'}>
            <Chip
              component="a"
              href={DEVELOPER_LINKEDIN}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              icon={<LinkedInIcon sx={{ fontSize: '16px !important', color: '#0A66C2 !important' }} />}
              label="Developed By: Bora Avcu"
              size="small"
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: 'text.primary',
                fontWeight: 700,
                fontSize: '0.75rem',
                px: 0.75,
                height: 28,
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.2),
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha('#0A66C2', 0.14),
                  borderColor: '#0A66C2',
                  transform: 'translateY(-1px)',
                },
              }}
            />
          </Tooltip>
        </Stack>
      </Container>
    </Box>
  );
}