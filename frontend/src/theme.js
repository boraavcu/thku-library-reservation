import { createTheme } from '@mui/material/styles';
import { trTR, enUS } from '@mui/material/locale';

// 1. Tasarım Ayarları (Figma'dan alınan güncel renk paleti)
const themeOptions = {
  palette: {
    // Birincil Renk (Kurumsal Mavi - #137FEC)
    primary: {
      main: '#137FEC',
      light: '#DBEAFE', // Açık mavi varyant (Hover veya arka planlar için)
      dark: '#1D4ED8',  // Koyu mavi varyant
      contrastText: '#FFFFFF',
    },
    // İkincil Renk (Tasarımdaki ikincil gri/lacivert tonları)
    secondary: {
      main: '#617589',
      light: '#F1F5F9',
      dark: '#4B5563',
      contrastText: '#FFFFFF',
    },
    // Arka Plan Renkleri
    background: {
      default: '#F6F7F8', // Genel sayfa arka planı
      paper: '#FFFFFF',   // Kart ve modül arka planları
    },
    // Metin Renkleri
    text: {
      primary: '#111418',   // Ana başlıklar ve belirgin metinler
      secondary: '#617589', // Alt başlıklar, açıklamalar ve pasif metinler
      disabled: '#9CA3AF',  // Devre dışı/silik metinler
    },
    // Durum Renkleri (Success, Error, Warning vb.)
    success: {
      main: '#16A34A',      // Onay / Aktif (Koyu yeşil)
      light: '#DCFCE7',     // Açık yeşil arka plan (Chip vs.)
      dark: '#15803D',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#EF4444',      // Hata / İptal (Kırmızı)
      light: '#FEE2E2',     // Açık kırmızı arka plan
      dark: '#DC2626',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#F97316',      // Beklemede / Duyuru (Turuncu)
      light: '#FFF7ED',     // Açık turuncu arka plan
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#137FEC',
      light: '#EFF6FF',
    },
    // Çizgiler ve Kenarlıklar (Borders)
    divider: '#F0F2F4',     // Ayırıcı çizgiler ve kart border'ları
    
    // Özel Aksiyon Renkleri
    action: {
      hover: '#EFF6FF',     // Mavi hover efekti
      selected: '#DBEAFE',
      disabled: '#E5E7EB',
      disabledBackground: '#F3F4F6',
    },
  },
  
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif', // Tasarımdaki asıl font Inter
    h1: { color: '#111418', fontWeight: 700 },
    h2: { color: '#111418', fontWeight: 700 },
    h3: { color: '#111418', fontWeight: 700 },
    h4: { color: '#111418', fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { color: '#111418', fontWeight: 700 },
    h6: { color: '#111418', fontWeight: 700 },
    subtitle1: { color: '#111418', fontWeight: 600 },
    subtitle2: { color: '#617589', fontWeight: 500 },
    body1: { color: '#111418' },
    body2: { color: '#617589' },
    button: { textTransform: 'none', fontWeight: 600 }, // Butonlarda büyük harf zorunluluğunu kaldırır
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          boxShadow: 'none', // Flat tasarım için buton gölgeleri kaldırıldı
          '&:hover': {
            boxShadow: 'none',
          },
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: '#1D4ED8', // Primary dark hover
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', // Tasarımdaki çok hafif soft gölge
          border: '1px solid #F0F2F4', // Özel figma border rengi
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Dark modda oluşan beyaz katmanı engeller
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          '&.Mui-selected': {
            backgroundColor: '#EFF6FF',
            borderLeft: '4px solid #137FEC',
            '&:hover': {
              backgroundColor: '#DBEAFE',
            },
          },
          '&:hover': {
            backgroundColor: '#F8FAFC',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: '6px', // Tam yuvarlak yerine hafif köşeli modern chipler
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF', // Header artık beyaz
          color: '#111418',           // Header metinleri siyah
          boxShadow: 'none',
          borderBottom: '1px solid #F0F2F4',
        },
      },
    },
  },
};

// 2. Tema Oluşturucu Fonksiyon
export const getAppTheme = (language = 'tr') => {
  const selectedLocale = language === 'en' ? enUS : trTR;
  return createTheme(themeOptions, selectedLocale);
};

// Varsayılan olarak Türkçe temayı dışarı aktarır
const theme = getAppTheme('tr');
export default theme;