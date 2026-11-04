import { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Paper, Chip, Divider, Button,
  Select, MenuItem, Pagination, InputAdornment, Dialog,
  DialogTitle, DialogContent, DialogActions, Alert,
  FormControlLabel, Switch
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BlockIcon from '@mui/icons-material/Block';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { ITEMS_PER_PAGE } from './adminConstants';
import { getFutureDateStr } from '../../utils/dateUtils';

export default function UsersTab({
  users = [],
  currentUserId,
  userRole,
  isAdminOrSuper,
  isSuperAdmin,
  isEn,
  runAction,
  onOpenCreateStaff,
  onResetStaffPassword,
}) {
  const theme = useTheme();
  const [userSearch, setUserSearch] = useState('');
  const [studentPage, setStudentPage] = useState(1);

  const [banDialog, setBanDialog] = useState({
    open: false,
    userId: null,
    fullName: '',
    email: '',
    banMode: 'DATE',
    banUntilDateStr: getFutureDateStr(30),
    banReason: '',
  });

  const { studentList, staffList } = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const matches = (u) =>
      !q ||
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.studentNumber || '').toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q);

    return {
      studentList: users.filter((u) => u.role === 'STUDENT' && matches(u)),
      staffList: users.filter((u) => u.role !== 'STUDENT' && matches(u)),
    };
  }, [users, userSearch]);

  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * ITEMS_PER_PAGE;
    return studentList.slice(start, start + ITEMS_PER_PAGE);
  }, [studentList, studentPage]);

  const minTomorrowDateStr = getFutureDateStr(1);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <TextField
        fullWidth
        size="small"
        placeholder={
          isEn
            ? 'Search student name, email, phone, student ID, or department...'
            : 'Öğrenci adı, e-posta, telefon numarası, öğrenci no veya bölüm ara...'
        }
        value={userSearch}
        onChange={(e) => {
          setUserSearch(e.target.value);
          setStudentPage(1);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {isEn ? `Student List & Ban Management (${studentList.length} Students)` : `Öğrenci Listesi ve Ban Yönetimi (${studentList.length} Öğrenci)`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isEn ? 'Page' : 'Sayfa'} {studentPage} / {Math.max(1, Math.ceil(studentList.length / ITEMS_PER_PAGE))}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          {paginatedStudents.map((u) => {
            const noShowCount = u._count?.penalties || 0;
            const banLabel = u.banUntil
              ? `BANLI (${new Date(u.banUntil).toLocaleDateString('tr-TR')} tarihine kadar)`
              : 'KALICI BANLI (PERMA BAN)';

            return (
              <Paper
                key={u.id}
                variant="outlined"
                sx={{
                  p: { xs: 1.75, sm: 2.25 },
                  borderRadius: 2,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.98rem' }}>
                      {u.fullName || 'İsimsiz Öğrenci'}
                    </Typography>
                    {u.studentNumber && (
                      <Chip label={`#${u.studentNumber}`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
                    )}
                    <Chip
                      label={u.phone ? `📞 ${u.phone}` : (isEn ? '📞 No Phone' : '📞 Telefon Girilmedi')}
                      size="small"
                      variant="outlined"
                      color={u.phone ? 'info' : 'default'}
                      sx={{ height: 22, fontSize: '0.72rem', fontWeight: u.phone ? 700 : 400 }}
                    />
                    {u.department && (
                      <Chip label={u.department} size="small" sx={{ height: 22, fontSize: '0.72rem' }} />
                    )}
                    <Chip
                      label={`No-Show: ${noShowCount} / 3`}
                      size="small"
                      color={noShowCount >= 3 ? 'error' : noShowCount > 0 ? 'warning' : 'default'}
                      sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                    />
                    {u.isBanned && (
                      <Chip
                        label={banLabel}
                        size="small"
                        color="error"
                        sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontSize: '0.78rem', wordBreak: 'break-all' }}>
                    {u.email} {u.banReason ? `• Sebep: ${u.banReason}` : ''}
                  </Typography>
                </Box>

                <Divider />
                {isAdminOrSuper ? (
                  <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(u.penaltyPoints > 0 || noShowCount > 0) && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestartAltIcon />}
                        onClick={() => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'RESET_PENALTY' }, 'Öğrencinin uyarı sayacı sıfırlandı.')}
                      >
                        {isEn ? 'Reset Warnings' : 'Uyarıları Sıfırla'}
                      </Button>
                    )}

                    {u.isBanned ? (
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'UNBAN' }, 'Öğrencinin yasağı (ban) kaldırıldı.')}
                      >
                        {isEn ? 'Unban Student' : 'Banı Aç (Yasağı Kaldır)'}
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<BlockIcon />}
                        onClick={() =>
                          setBanDialog({
                            open: true,
                            userId: u.id,
                            fullName: u.fullName || u.email,
                            email: u.email,
                            banMode: 'DATE',
                            banUntilDateStr: getFutureDateStr(30),
                            banReason: '',
                          })
                        }
                      >
                        {isEn ? 'Ban (Select Date / Permanent)' : 'Banla (Tarih Seç / Kalıcı Ban)'}
                      </Button>
                    )}

                    <Select
                      size="small"
                      value={u.role}
                      onChange={(e) => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'CHANGE_ROLE', role: e.target.value }, 'Kullanıcı rolü güncellendi.')}
                      sx={{ minWidth: { xs: '100%', sm: 220 }, height: 32, fontSize: '0.8rem' }}
                    >
                      <MenuItem value="STUDENT">STUDENT (Öğrenci)</MenuItem>
                      <MenuItem value="LIBRARIAN">LIBRARIAN (Görevli Ata)</MenuItem>
                      {isSuperAdmin && <MenuItem value="ADMIN">ADMIN (Müdür Ata - Sadece BİM)</MenuItem>}
                      {isSuperAdmin && <MenuItem value="SUPER_ADMIN">SUPER_ADMIN (BİM Ata)</MenuItem>}
                    </Select>
                  </Box>
                ) : (
                  <Box>
                    <Chip label="Sadece Görüntüleme (Görevli)" size="small" variant="outlined" />
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>

        {studentList.length > ITEMS_PER_PAGE && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
            <Pagination
              count={Math.ceil(studentList.length / ITEMS_PER_PAGE)}
              page={studentPage}
              onChange={(_, p) => setStudentPage(p)}
              color="primary"
            />
          </Box>
        )}
      </Box>

      <Divider />

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {isEn ? `Library Staff & System Administrators (${staffList.length})` : `Kütüphane Görevlileri ve Sistem Yöneticileri (${staffList.length} Yetkili)`}
          </Typography>
          {isAdminOrSuper && onOpenCreateStaff && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<PersonAddAlt1Icon />}
              onClick={onOpenCreateStaff}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              {isEn ? 'Add Staff (@thk.edu.tr)' : 'Personel Ekle (@thk.edu.tr)'}
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {staffList.map((u) => {
            const canModifyThisStaff = isSuperAdmin || (userRole === 'ADMIN' && u.role === 'LIBRARIAN');
            const isInstitutionalStaff =
              u.email?.toLowerCase().endsWith('@thk.edu.tr') &&
              !u.email?.toLowerCase().endsWith('@stu.thk.edu.tr');

            return (
              <Paper
                key={u.id}
                variant="outlined"
                sx={{
                  p: { xs: 1.75, sm: 2.25 },
                  borderRadius: 2,
                  flexShrink: 0,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 800 }}>{u.fullName}</Typography>
                    <Chip label={u.role} size="small" color="primary" sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700 }} />
                    <Chip
                      label={u.isActive !== false ? (isEn ? 'ACTIVE' : 'AKTİF') : isEn ? 'INACTIVE' : 'PASİF'}
                      size="small"
                      color={u.isActive !== false ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
                    />
                    {u.phone && (
                      <Chip label={`📞 ${u.phone}`} size="small" variant="outlined" color="info" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, wordBreak: 'break-all' }}>
                    {u.email} • {u.department}
                  </Typography>
                </Box>

                <Divider />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  {canModifyThisStaff ? (
                    <>
                      <Select
                        size="small"
                        value={u.role}
                        onChange={(e) => runAction('USER_MODERATION', { targetUserId: u.id, modType: 'CHANGE_ROLE', role: e.target.value }, 'Yetkili rolü güncellendi.')}
                        sx={{ minWidth: { xs: '100%', sm: 220 }, height: 32, fontSize: '0.8rem', bgcolor: 'background.paper' }}
                      >
                        <MenuItem value="STUDENT">STUDENT (Öğrenciye Düşür)</MenuItem>
                        <MenuItem value="LIBRARIAN">LIBRARIAN (Görevli)</MenuItem>
                        {isSuperAdmin && <MenuItem value="ADMIN">ADMIN (Müdür)</MenuItem>}
                        {isSuperAdmin && <MenuItem value="SUPER_ADMIN">SUPER_ADMIN (BİM)</MenuItem>}
                      </Select>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={u.isActive !== false}
                            disabled={u.id === currentUserId}
                            onChange={(_, checked) =>
                              runAction(
                                'USER_MODERATION',
                                { targetUserId: u.id, modType: 'SET_STAFF_ACTIVE', isActive: checked },
                                checked
                                  ? isEn
                                    ? 'Account activated.'
                                    : 'Hesap aktif edildi.'
                                  : isEn
                                  ? 'Account deactivated.'
                                  : 'Hesap pasifleştirildi.'
                              )
                            }
                          />
                        }
                        label={
                          <Typography variant="caption" fontWeight={700}>
                            {isEn ? 'Active' : 'Aktif'}
                          </Typography>
                        }
                      />
                      {isInstitutionalStaff && onResetStaffPassword && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<VpnKeyIcon />}
                          onClick={() => onResetStaffPassword(u)}
                        >
                          {isEn ? 'New temporary password' : 'Yeni geçici şifre üret'}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Chip
                      label={isEn ? 'Only IT Admin (SUPER_ADMIN) can modify this role' : 'Bu yetkili seviyesini yalnızca BİM (SUPER_ADMIN) değiştirebilir'}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.72rem' }}
                    />
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>

      <Dialog
        open={banDialog.open}
        onClose={() => setBanDialog({ ...banDialog, open: false })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'error.main' }}>
          Öğrenciyi Yasakla (Takvimli / Kalıcı Ban)
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>{banDialog.fullName}</strong> ({banDialog.email}) öğrencisi için ban türünü seçiniz:
          </Typography>

          <Select
            size="small"
            fullWidth
            value={banDialog.banMode}
            onChange={(e) => setBanDialog({ ...banDialog, banMode: e.target.value })}
          >
            <MenuItem value="DATE">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonthIcon fontSize="small" color="primary" />
                <span>Belirli Bir Tarihe Kadar Banla (Takvimden Seç)</span>
              </Box>
            </MenuItem>
            <MenuItem value="PERMANENT">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AllInclusiveIcon fontSize="small" color="error" />
                <span>Kalıcı Banla (Perma Ban - Süresiz)</span>
              </Box>
            </MenuItem>
          </Select>

          {banDialog.banMode === 'DATE' && (
            <Box>
              <TextField
                label="Ban Bitiş Tarihi (Takvimden Gün Seçiniz)"
                type="date"
                size="small"
                fullWidth
                value={banDialog.banUntilDateStr}
                onChange={(e) => setBanDialog({ ...banDialog, banUntilDateStr: e.target.value })}
                inputProps={{ min: minTomorrowDateStr }}
                InputLabelProps={{ shrink: true }}
              />
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                {[
                  { label: '+7 Gün', days: 7 },
                  { label: '+14 Gün', days: 14 },
                  { label: '+30 Gün', days: 30 },
                  { label: '+90 Gün', days: 90 },
                ].map((preset) => (
                  <Chip
                    key={preset.days}
                    label={preset.label}
                    size="small"
                    variant="outlined"
                    onClick={() => setBanDialog({ ...banDialog, banUntilDateStr: getFutureDateStr(preset.days) })}
                    sx={{ cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {banDialog.banMode === 'PERMANENT' && (
            <Alert severity="error" sx={{ py: 0.5, fontSize: '0.78rem' }}>
              Kalıcı (Perma) ban seçildiğinde öğrencinin rezervasyon yetkisi yönetici tarafından manuel açılana kadar süresiz kapatılır.
            </Alert>
          )}

          <TextField
            label="Ban Sebebi (Öğrenciye e-posta ile iletilir)"
            size="small"
            fullWidth
            multiline
            rows={2}
            placeholder="Örn: Çalışma odası kurallarının ihlali / 3 kez No-Show"
            value={banDialog.banReason}
            onChange={(e) => setBanDialog({ ...banDialog, banReason: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBanDialog({ ...banDialog, open: false })} color="inherit">
            Vazgeç
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              runAction(
                'USER_MODERATION',
                {
                  targetUserId: banDialog.userId,
                  modType: 'BAN_USER',
                  banMode: banDialog.banMode,
                  banUntilDateStr: banDialog.banUntilDateStr,
                  banReason: banDialog.banReason,
                },
                banDialog.banMode === 'PERMANENT'
                  ? 'Öğrenci kalıcı olarak (Perma Ban) yasaklandı.'
                  : `Öğrenci ${banDialog.banUntilDateStr} tarihine kadar banlandı.`
              );
              setBanDialog({ ...banDialog, open: false });
            }}
          >
            Yasağı Uygula
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
