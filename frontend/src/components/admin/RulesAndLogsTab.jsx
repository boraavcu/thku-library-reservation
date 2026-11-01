import { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Chip, Button, Divider,
  TextField, InputAdornment, Alert, Pagination
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SearchIcon from '@mui/icons-material/Search';
import { RULE_META, ITEMS_PER_PAGE, formatAuditLog } from './adminConstants';

export default function RulesAndLogsTab({
  rules = [],
  auditLogs = [],
  adminActions = [],
  logRetentionPolicy,
  isEn,
  runAction,
}) {
  const theme = useTheme();
  const [logSearch, setLogSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [adminLogPage, setAdminLogPage] = useState(1);

  const filteredAuditLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter((log) => {
      const formatted = formatAuditLog(log, isEn);
      return (
        (log.action || '').toLowerCase().includes(q) ||
        (log.user?.fullName || '').toLowerCase().includes(q) ||
        (log.user?.email || '').toLowerCase().includes(q) ||
        (formatted.badge || '').toLowerCase().includes(q) ||
        (formatted.title || '').toLowerCase().includes(q) ||
        (formatted.detail || '').toLowerCase().includes(q)
      );
    });
  }, [auditLogs, logSearch, isEn]);

  const filteredAdminLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return adminActions;
    return adminActions.filter((act) => {
      return (
        (act.actionType || '').toLowerCase().includes(q) ||
        (act.description || '').toLowerCase().includes(q) ||
        (act.admin?.fullName || '').toLowerCase().includes(q) ||
        (act.admin?.email || '').toLowerCase().includes(q)
      );
    });
  }, [adminActions, logSearch]);

  const paginatedAuditLogs = useMemo(() => {
    const start = (auditPage - 1) * ITEMS_PER_PAGE;
    return filteredAuditLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAuditLogs, auditPage]);

  const paginatedAdminLogs = useMemo(() => {
    const start = (adminLogPage - 1) * ITEMS_PER_PAGE;
    return filteredAdminLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAdminLogs, adminLogPage]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          {isEn ? 'Library Reservation Rules (Dynamic Settings)' : 'Kütüphane Rezervasyon Kuralları (Dinamik Ayarlar)'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {isEn
            ? 'Changes made here immediately update both backend validation and student-facing rule notices.'
            : 'Buradan değiştirdiğiniz kurallar hem arka plandaki kontrolleri hem de öğrenci ekranlarındaki uyarı metinlerini anında günceller.'}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {rules.map((rule) => {
            const meta = RULE_META[rule.ruleName] || {
              title: rule.ruleName,
              titleEn: rule.ruleName,
              desc: 'Sistem rezervasyon parametresi.',
              descEn: 'System reservation parameter.',
              unit: '',
              unitEn: '',
              min: 1,
              max: 60,
              step: 1,
            };
            const currentVal = rule.ruleValue?.value ?? 1;
            const stepVal = meta.step || 1;

            return (
              <Paper
                key={rule.id}
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', color: 'text.primary' }}>
                    {isEn ? meta.titleEn : meta.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mt: 0.5 }}>
                    {isEn ? meta.descEn : meta.desc}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pt: 1,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  <Chip
                    label={`${isEn ? 'Current:' : 'Mevcut Değer:'} ${currentVal} ${isEn ? meta.unitEn : meta.unit}`}
                    color="primary"
                    sx={{ fontWeight: 800 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={currentVal <= meta.min}
                      onClick={() =>
                        runAction(
                          'UPDATE_RULE',
                          { ruleName: rule.ruleName, value: Math.max(meta.min, currentVal - stepVal) },
                          `${meta.title} güncellendi.`
                        )
                      }
                    >
                      {isEn ? `Decrease (-${stepVal})` : `Azalt (-${stepVal})`}
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={currentVal >= meta.max}
                      onClick={() =>
                        runAction(
                          'UPDATE_RULE',
                          { ruleName: rule.ruleName, value: Math.min(meta.max, currentVal + stepVal) },
                          `${meta.title} güncellendi.`
                        )
                      }
                    >
                      {isEn ? `Increase (+${stepVal})` : `Artır (+${stepVal})`}
                    </Button>
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Box>

      <Divider />

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.2),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Inventory2OutlinedIcon color="primary" />
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {isEn
                ? 'Log Retention & Archiving Policy (180 Days Active / 1 Year Archive)'
                : 'Log Saklama ve Arşivleme Politikası (Müdürlük & BİM Denetimi)'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {isEn ? (
                <>
                  Showing activity logs for the <strong>last {logRetentionPolicy?.activeDisplayDays || 180} days (1 Semester)</strong>. Older logs are archived in the database for <strong>1 Year (365 Days)</strong>.
                </>
              ) : (
                <>
                  Bu ekranda yalnızca <strong>son {logRetentionPolicy?.activeDisplayDays || 180} günün (1 Akademik Dönem)</strong> hareket kayıtları listelenmektedir. 180 günü aşan kayıtlar <strong>1 Yıl (365 Gün)</strong> boyunca veritabanı arşivinde saklanır.
                </>
              )}
            </Typography>
          </Box>
        </Box>
        <Chip
          label={
            isEn
              ? `1-Year Archive Records: ${logRetentionPolicy?.archivedRecordsCount || 0}`
              : `1 Yıllık Arşivdeki Kayıt: ${logRetentionPolicy?.archivedRecordsCount || 0}`
          }
          color="primary"
          variant="outlined"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      </Paper>

      <TextField
        fullWidth
        size="small"
        placeholder={
          isEn
            ? 'Search in student & admin logs (Student name, email, room code R101, No-Show, Ban, Check-In)...'
            : 'Öğrenci ve yönetici loglarında ara (Öğrenci adı, e-posta, oda kodu R101, No-Show, Ban, Kiosk)...'
        }
        value={logSearch}
        onChange={(e) => {
          setLogSearch(e.target.value);
          setAuditPage(1);
          setAdminLogPage(1);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {isEn ? '1. Student & System Logs (Last 180 Days)' : '1. Öğrenci & Sistem Logları (Son 180 Gün)'}
              </Typography>
              <Chip label={`${filteredAuditLogs.length}`} size="small" />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {paginatedAuditLogs.length === 0 ? (
                <Alert severity="info">
                  {isEn ? 'No matching student/system logs found.' : 'Arama kriterine uygun öğrenci/sistem logu bulunamadı.'}
                </Alert>
              ) : (
                paginatedAuditLogs.map((log) => {
                  const formatted = formatAuditLog(log, isEn);
                  return (
                    <Paper
                      key={log.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        minHeight: 118,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                          <Chip label={formatted.badge} size="small" color={formatted.color} sx={{ fontWeight: 700, height: 22 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {new Date(log.createdAt).toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          {formatted.title}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-word', pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                        {formatted.detail}
                      </Typography>
                    </Paper>
                  );
                })
              )}
            </Box>
          </Box>

          {filteredAuditLogs.length > ITEMS_PER_PAGE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
              <Pagination
                size="small"
                count={Math.ceil(filteredAuditLogs.length / ITEMS_PER_PAGE)}
                page={auditPage}
                onChange={(_, p) => setAuditPage(p)}
                color="primary"
              />
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {isEn ? '2. Admin Intervention Logs (Last 180 Days)' : '2. Yönetici Müdahale Logları (Son 180 Gün)'}
              </Typography>
              <Chip label={`${filteredAdminLogs.length}`} size="small" />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {paginatedAdminLogs.length === 0 ? (
                <Alert severity="info">
                  {isEn ? 'No matching admin logs found.' : 'Arama kriterine uygun yönetici logu bulunamadı.'}
                </Alert>
              ) : (
                paginatedAdminLogs.map((act) => (
                  <Paper
                    key={act.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      minHeight: 118,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                        <Chip label={act.actionType} size="small" color="secondary" sx={{ fontWeight: 700, height: 22 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {new Date(act.createdAt).toLocaleString(isEn ? 'en-US' : 'tr-TR')}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {act.description}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                      {isEn ? 'Performed By:' : 'İşlemi Yapan Yetkili:'} {act.admin?.fullName} ({act.admin?.email})
                    </Typography>
                  </Paper>
                ))
              )}
            </Box>
          </Box>

          {filteredAdminLogs.length > ITEMS_PER_PAGE && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2.5 }}>
              <Pagination
                size="small"
                count={Math.ceil(filteredAdminLogs.length / ITEMS_PER_PAGE)}
                page={adminLogPage}
                onChange={(_, p) => setAdminLogPage(p)}
                color="secondary"
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}