import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Typography } from '@mui/material';
import { Navigate } from 'react-router-dom';
import { signOut, useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import PasswordField from '../components/PasswordField';
import api from '../api';

export default function ChangePassword() {
  const { t } = useTranslation();
  const { data: session, status } = useSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (status === 'loading') return null;
  if (!session?.user?.id) return <Navigate to="/" replace />;
  if (!session.user.mustChangePassword) return <Navigate to="/dashboard" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/account/password', { password, confirm });
      setPassword('');
      setConfirm('');
      await signOut({ redirect: false });
      window.location.assign(`${window.location.origin}/randevu/`);
    } catch (err) {
      setError(err.response?.data?.error || t('passwordChangeFailed'));
      setSaving(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 460 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {t('setNewPassword')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('setNewPasswordHelp')}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PasswordField
              label={t('newPassword')}
              name="new-password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              required
              fullWidth
            />
            <PasswordField
              label={t('confirmNewPassword')}
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              showLabel={t('showPassword')}
              hideLabel={t('hidePassword')}
              required
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={saving}>
              {t('savePasswordAndSignIn')}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
