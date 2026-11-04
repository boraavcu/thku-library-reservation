import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider, CssBaseline } from '@mui/material'
import App from './App.jsx'
import theme from './theme' 
import './i18n' 
import { SessionProvider } from "next-auth/react"
import { AUTH_BASE } from './runtimePaths'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SessionProvider basePath={AUTH_BASE}>
      <BrowserRouter basename="/randevu">
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </SessionProvider>
  </React.StrictMode>,
)
