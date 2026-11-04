import { useState } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export default function PasswordField({
  showLabel = 'Şifreyi göster',
  hideLabel = 'Şifreyi gizle',
  readOnly = false,
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      spellCheck={false}
      InputProps={{
        readOnly,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={visible ? hideLabel : showLabel}
              aria-pressed={visible}
              onClick={() => setVisible((current) => !current)}
              edge="end"
            >
              {visible ? <VisibilityOff /> : <Visibility />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}
