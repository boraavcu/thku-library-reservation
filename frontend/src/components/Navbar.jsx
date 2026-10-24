import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Typography, Avatar, IconButton, Badge, Button,
  Paper, Container, Menu, MenuItem, Divider, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSession, signOut } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import api from '../api';

import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CampaignIcon from '@mui/icons-material/Campaign';
import GavelIcon from '@mui/icons-material/Gavel';
import LanguageIcon from '@mui/icons-material/Language';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import HomeIcon from '@mui/icons-material/Home';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

const THKU_LOGO = "https://upload.wikimedia.org/wikipedia/tr/4/4f/T%C3%BCrk_Hava_Kurumu_%C3%9Cniversitesi_logo.png";

const NAV_LINKS = [
  { labelKey: 'navDashboard', path: '/dashboard' },
  { labelKey: 'navStudyRooms', path: '/reserve' },
  { labelKey: 'navMyBookings', path: '/bookings' },
];

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language?.substring(0, 2) || 'tr';
  const isEn = currentLang === 'en';
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const userRole = session?.user?.role;
  const isStaff = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'].includes(userRole);
  const isAdminOrSuper = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);

  // Kütüphane Görevlisi (LIBRARIAN) yalnızca "Öğrenci Ekranı" geçiş butonuna basıp
  // /dashboard, /reserve veya /bookings sayfalarına geçtiğinde öğrenci menüsünü görür.
  // /profile, /admin, /kiosk ve /rules sayfalarında tüm yetkililer (LIBRARIAN, ADMIN, SUPER_ADMIN) Yetkili Navbar'ını görür.
  const isLibrarianInStudentMode =
    userRole === 'LIBRARIAN' &&
    ['/dashboard', '/reserve', '/bookings'].some((p) => location.pathname.startsWith(p));

  const showStaffNavbar = isStaff && !isLibrarianInStudentMode;

  const storageKey = session?.user?.email ? `thku_read_notifs_${session.user.email}` : 'thku_read_notifs';

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setReadIds(Array.isArray(saved) ? saved : []);
    } catch {
      setReadIds([]);
    }
  }, [storageKey]);

  const fetchNotifications = () => {
    if (!session?.user?.acceptedAgreementVersion) return;
    if (!isAdminOrSuper) {
      api.get('/invitations').then(r => setInvitations(r.data || [])).catch(() => {});
    }
    api.get('/announcements').then(r => setAnnouncements(r.data || [])).catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
  }, [session, location.pathname]);

  const markAsRead = (id) => {
    if (!readIds.includes(id)) {
      const updated = [...readIds, id];
      setReadIds(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  };

  const markAllAsRead = () => {
    const allIds = [
      ...invitations.map(i => `inv_${i.id}`),
      ...announcements.map(a => `ann_${a.id}`),
    ];
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const unreadInvitations = invitations.filter(i => !readIds.includes(`inv_${i.id}`));
  const unreadAnnouncements = announcements.filter(a => !readIds.includes(`ann_${a.id}`));
  const unreadCount = unreadInvitations.length + unreadAnnouncements.length;
  const totalItems = invitations.length + announcements.length;

  const toggleLanguage = () => {
    const newLang = currentLang === 'tr' ? 'en' : 'tr';
    i18n.changeLanguage(newLang);
  };

  const handleOpenNotifDetail = (item, type) => {
    const itemKey = type === 'INVITATION' ? `inv_${item.id}` : `ann_${item.id}`;
    markAsRead(itemKey);
    setNotifAnchor(null);
    setSelectedNotif({ type, item });
  };

  const handleRespondFromModal = async (participantId, action) => {
    try {
      await api.post('/invitations/respond', { participantId, action });
      setSelectedNotif(null);
      fetchNotifications();
      navigate('/bookings');
    } catch {
      setSelectedNotif(null);
    }
  };

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          position: 'sticky', top: 0, zIndex: 1100,
          borderBottom: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper', borderRadius: 0,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>

            {/* Sol - THKÜ Logo */}
            <Box
              onClick={() =>
                navigate(
                  showStaffNavbar
                    ? '/admin'
                    : isLibrarianInStudentMode
                    ? '/dashboard?studentView=true'
                    : '/dashboard'
                )
              }
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
            >
              <Avatar
                src={THKU_LOGO}
                alt="THKÜ Logo"
                sx={{
                  width: 42, height: 42,
                  bgcolor: 'background.paper',
                  p: 0.25,
                  border: '1px solid', borderColor: 'divider',
                }}
                imgProps={{ style: { objectFit: 'contain' } }}
              />
              <Box>
                <Typography variant="h6" sx={{ lineHeight: 1.2, fontSize: '1rem', display: { xs: 'none', sm: 'block' } }}>
                  {t('navUniversity')}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 500, fontSize: '0.75rem' }}>
                  {t('navSystem')}
                </Typography>
              </Box>
            </Box>

            {/* Orta - Rol Bazlı Menü Bağlantıları */}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
              {showStaffNavbar ? (
                <>
                  <Button
                    onClick={() => navigate('/admin')}
                    sx={{
                      color: location.pathname === '/admin' ? 'primary.main' : 'text.secondary',
                      bgcolor: location.pathname === '/admin' ? 'action.hover' : 'transparent',
                      fontWeight: location.pathname === '/admin' ? 700 : 600,
                      fontSize: '0.875rem',
                      px: 2,
                      '&:hover': { bgcolor: 'action.hover', color: 'primary.main' },
                    }}
                  >
                    {isEn ? 'Management & Analytics Center' : 'Yönetim & Analiz Merkezi'}
                  </Button>
                  <Button
                    onClick={() => navigate('/kiosk')}
                    sx={{
                      color: location.pathname === '/kiosk' ? 'primary.main' : 'text.secondary',
                      bgcolor: location.pathname === '/kiosk' ? 'action.hover' : 'transparent',
                      fontWeight: location.pathname === '/kiosk' ? 700 : 600,
                      fontSize: '0.875rem',
                      px: 2,
                      '&:hover': { bgcolor: 'action.hover', color: 'primary.main' },
                    }}
                  >
                    {isEn ? 'Door QR Poster (/kiosk)' : 'Kapı QR Posteri (/kiosk)'}
                  </Button>
                </>
              ) : (
                <>
                  {NAV_LINKS.map(item => (
                    <Button
                      key={item.path}
                      onClick={() =>
                        navigate(
                          item.path === '/dashboard' && userRole === 'LIBRARIAN'
                            ? '/dashboard?studentView=true'
                            : item.path
                        )
                      }
                      sx={{
                        color: location.pathname === item.path ? 'primary.main' : 'text.secondary',
                        bgcolor: location.pathname === item.path ? 'action.hover' : 'transparent',
                        fontWeight: location.pathname === item.path ? 700 : 500,
                        fontSize: '0.875rem', px: 2,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      {t(item.labelKey)}
                    </Button>
                  ))}
                  {userRole === 'LIBRARIAN' && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/admin')}
                      sx={{ ml: 1, fontWeight: 700, fontSize: '0.78rem', borderRadius: 2 }}
                    >
                      {isEn ? 'Back to Admin' : 'Yönetim Merkezine Dön'}
                    </Button>
                  )}
                </>
              )}
            </Box>

            {/* Sağ - Dil Seçimi + Bildirim Zili + Kullanıcı */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>

              {/* TR / EN Dil Değiştirme Butonu */}
              <Tooltip title={isEn ? "Türkçe'ye Geç" : 'Switch to English'}>
                <Button
                  size="small"
                  onClick={toggleLanguage}
                  startIcon={<LanguageIcon fontSize="small" />}
                  sx={{
                    minWidth: 64,
                    px: 1.25,
                    py: 0.5,
                    borderRadius: 2,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: 'primary.main',
                    bgcolor: 'action.hover',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                  }}
                >
                  {currentLang.toUpperCase()}
                </Button>
              </Tooltip>

              {/* Bildirim Zili */}
              <IconButton
                size="small"
                onClick={(e) => setNotifAnchor(e.currentTarget)}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'action.hover' } }}
              >
                <Badge
                  badgeContent={unreadCount}
                  color="error"
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 18, minWidth: 18 } }}
                >
                  <NotificationsIcon fontSize="small" />
                </Badge>
              </IconButton>

              {/* Bildirim Açılır Menüsü */}
              <Menu
                anchorEl={notifAnchor}
                open={Boolean(notifAnchor)}
                onClose={() => setNotifAnchor(null)}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 1, width: 350, maxWidth: '92vw', borderRadius: '12px', py: 1,
                      boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)',
                    },
                  },
                }}
              >
                <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {isEn ? 'Notifications' : 'Bildirimler'}
                    </Typography>
                    <Chip
                      label={isEn ? `${unreadCount} Unread` : `${unreadCount} Okunmamış`}
                      size="small"
                      color={unreadCount > 0 ? 'error' : 'default'}
                      sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                    />
                  </Box>
                  {unreadCount > 0 && (
                    <Tooltip title={isEn ? 'Mark all as read' : 'Tümünü okundu işaretle'}>
                      <IconButton size="small" onClick={markAllAsRead} color="primary">
                        <DoneAllIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Divider sx={{ my: 0.5 }} />

                {totalItems === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {isEn ? 'No notifications.' : 'Yeni bildiriminiz bulunmuyor.'}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
                    {invitations.map((inv) => {
                      const isRead = readIds.includes(`inv_${inv.id}`);
                      return (
                        <MenuItem
                          key={inv.id}
                          onClick={() => handleOpenNotifDetail(inv, 'INVITATION')}
                          sx={{
                            py: 1.25, px: 2, gap: 1.5, whiteSpace: 'normal', alignItems: 'flex-start',
                            bgcolor: isRead ? 'transparent' : alpha(theme.palette.warning.main, 0.06),
                            borderLeft: isRead ? '3px solid transparent' : `3px solid ${theme.palette.warning.main}`,
                          }}
                        >
                          <MailOutlineIcon color={isRead ? 'disabled' : 'warning'} sx={{ fontSize: 20, mt: 0.25 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: isRead ? 500 : 700 }}>
                              {isEn ? 'Room Invitation' : 'Çalışma Odası Daveti'}: {inv.reservation?.room?.name || inv.reservation?.room?.roomNumber}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                              {inv.reservation?.user?.fullName} • {isEn ? 'Click to view & respond' : 'Detay ve onay için tıklayın'}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })}

                    {announcements.map((ann) => {
                      const isRead = readIds.includes(`ann_${ann.id}`);
                      const title = ann.title?.[currentLang] || ann.title?.tr || ann.title;
                      return (
                        <MenuItem
                          key={ann.id}
                          onClick={() => handleOpenNotifDetail(ann, 'ANNOUNCEMENT')}
                          sx={{
                            py: 1.25, px: 2, gap: 1.5, whiteSpace: 'normal', alignItems: 'flex-start',
                            bgcolor: isRead ? 'transparent' : alpha(theme.palette.primary.main, 0.05),
                            borderLeft: isRead ? '3px solid transparent' : `3px solid ${theme.palette.primary.main}`,
                          }}
                        >
                          <CampaignIcon color={isRead ? 'disabled' : 'primary'} sx={{ fontSize: 20, mt: 0.25 }} />
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: isRead ? 500 : 700 }}>
                              {title}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                              {isEn ? 'Click to read full announcement' : 'Duyuru içeriğini okumak için tıklayın'}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Box>
                )}
              </Menu>

              {/* Kullanıcı Profil Bölümü */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: { xs: 1, sm: 2 }, borderLeft: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: { xs: 'none', md: 'block' }, textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, color: 'text.primary' }}>
                    {session?.user?.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.2 }}>
                    {session?.user?.studentNumber ? `${t('studentId')}: ${session.user.studentNumber}` : session?.user?.role}
                  </Typography>
                </Box>
                <Avatar
                  onClick={(e) => setMenuAnchor(e.currentTarget)}
                  src={session?.user?.image}
                  alt={session?.user?.name}
                  sx={{
                    width: 36, height: 36, cursor: 'pointer', bgcolor: 'primary.main',
                    outline: menuAnchor ? `2.5px solid ${theme.palette.primary.main}` : '2.5px solid transparent',
                    outlineOffset: 2,
                  }}
                />
              </Box>

              {/* Sağ Üst Profil Açılır Menüsü */}
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                onClick={() => setMenuAnchor(null)}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 1, minWidth: 215, borderRadius: '10px', py: 0.5,
                      boxShadow: '0 8px 24px -4px rgba(0,0,0,0.1)',
                    },
                  },
                }}
              >
                <MenuItem onClick={() => navigate('/profile')} sx={{ py: 1, px: 2, gap: 1.25 }}>
                  <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{t('profile')}</Typography>
                </MenuItem>

                {/* Yetkili modundayken Yönetim Merkezi; Öğrenci modundayken Rezervasyonlarım ve Mobil Linkler */}
                {showStaffNavbar ? (
                  <>
                    <MenuItem onClick={() => navigate('/admin')} sx={{ py: 1, px: 2, gap: 1.25 }}>
                      <AdminPanelSettingsIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {isEn ? 'Management Center' : 'Yönetim Merkezi'}
                      </Typography>
                    </MenuItem>
                    <MenuItem onClick={() => navigate('/kiosk')} sx={{ py: 1, px: 2, gap: 1.25, display: { xs: 'flex', md: 'none' } }}>
                      <QrCodeScannerIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>
                        {isEn ? 'Door QR Poster' : 'Kapı QR Posteri'}
                      </Typography>
                    </MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem
                      onClick={() => navigate(userRole === 'LIBRARIAN' ? '/dashboard?studentView=true' : '/dashboard')}
                      sx={{ py: 1, px: 2, gap: 1.25, display: { xs: 'flex', md: 'none' } }}
                    >
                      <HomeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{t('navDashboard')}</Typography>
                    </MenuItem>
                    <MenuItem
                      onClick={() => navigate('/reserve')}
                      sx={{ py: 1, px: 2, gap: 1.25, display: { xs: 'flex', md: 'none' } }}
                    >
                      <MeetingRoomIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{t('navStudyRooms')}</Typography>
                    </MenuItem>
                    <MenuItem onClick={() => navigate('/bookings')} sx={{ py: 1, px: 2, gap: 1.25 }}>
                      <MailOutlineIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{t('navMyBookings')}</Typography>
                    </MenuItem>
                    {userRole === 'LIBRARIAN' && (
                      <MenuItem onClick={() => navigate('/admin')} sx={{ py: 1, px: 2, gap: 1.25 }}>
                        <AdminPanelSettingsIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'primary.main' }}>
                          {isEn ? 'Back to Admin' : 'Yönetim Merkezine Dön'}
                        </Typography>
                      </MenuItem>
                    )}
                  </>
                )}

                <MenuItem onClick={() => navigate('/rules?view=true')} sx={{ py: 1, px: 2, gap: 1.25 }}>
                  <GavelIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{t('reservationRules')}</Typography>
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}
                  sx={{ py: 1, px: 2, gap: 1.25, '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.05) } }}
                >
                  <LogoutIcon sx={{ fontSize: 18, color: 'error.main' }} />
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'error.main' }}>{t('logout')}</Typography>
                </MenuItem>
              </Menu>
            </Box>

          </Box>
        </Container>
      </Paper>

      {/* Bildirim / Duyuru Detay Pop-up Modalı */}
      <Dialog
        open={Boolean(selectedNotif)}
        onClose={() => setSelectedNotif(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedNotif?.type === 'ANNOUNCEMENT' && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
              <CampaignIcon color="primary" />
              {selectedNotif.item.title?.[currentLang] || selectedNotif.item.title?.tr || selectedNotif.item.title}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body1" sx={{ lineHeight: 1.7, color: 'text.primary' }}>
                {selectedNotif.item.content?.[currentLang] || selectedNotif.item.content?.tr || selectedNotif.item.content}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button variant="contained" onClick={() => setSelectedNotif(null)}>
                {isEn ? 'Close' : 'Anladım, Kapat'}
              </Button>
            </DialogActions>
          </>
        )}

        {selectedNotif?.type === 'INVITATION' && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
              <MailOutlineIcon color="warning" />
              {isEn ? 'Study Room Invitation' : 'Çalışma Odası Grup Daveti'}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                {t('invitedYouTo', {
                  name: selectedNotif.item.reservation?.user?.fullName,
                  room: `${selectedNotif.item.reservation?.room?.roomNumber} - ${selectedNotif.item.reservation?.room?.name}`,
                })}
              </Typography>
              {selectedNotif.item.reservation?.purpose && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  <strong>{isEn ? 'Purpose' : 'Çalışma Amacı'}:</strong> {selectedNotif.item.reservation.purpose}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {isEn
                  ? 'Would you like to join this group study session?'
                  : 'Bu grup çalışması rezervasyonuna katılmak istiyor musunuz?'}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
              <Button onClick={() => setSelectedNotif(null)} color="inherit">
                {isEn ? 'Later' : 'Daha Sonra'}
              </Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<HighlightOffIcon />}
                  onClick={() => handleRespondFromModal(selectedNotif.item.id, 'REJECT')}
                >
                  {t('reject')}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleOutlineIcon />}
                  onClick={() => handleRespondFromModal(selectedNotif.item.id, 'ACCEPT')}
                >
                  {t('accept')}
                </Button>
              </Box>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}