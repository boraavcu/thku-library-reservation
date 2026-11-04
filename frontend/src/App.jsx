import AdminPanel from './pages/AdminPanel';
import Kiosk from './pages/Kiosk';
import MyBookings from './pages/MyBookings';
import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from 'next-auth/react';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import RulesAcceptance from './pages/RulesAcceptance';
import StudyRooms from './pages/StudyRooms';
import ReserveForm from './pages/ReserveForm';
import Profile from './pages/Profile';

function RequirePasswordChanged({ children }) {
  const { data: session, status } = useSession();
  if (status === 'loading') return null;
  if (session?.user?.id && session.user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function App() {
  const { data: session, update } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session?.user) return;
    const role = session.user.role;
    const host = window.location.host;

    if (host.includes('panel.library.thk.edu.tr')) {
      if (!['ADMIN', 'LIBRARIAN', 'SUPER_ADMIN'].includes(role)) {
        window.location.href = 'https://library.thk.edu.tr';
      }
    }
  }, [session]);

  useEffect(() => {
    const handleRulesRejected = async () => {
      await update({ acceptedAgreementVersion: null });
      navigate('/rules');
    };

    window.addEventListener('rulesRejected', handleRulesRejected);
    return () => {
      window.removeEventListener('rulesRejected', handleRulesRejected);
    };
  }, [update, navigate]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/rules" element={<RequirePasswordChanged><RulesAcceptance /></RequirePasswordChanged>} />
      <Route path="/dashboard" element={<RequirePasswordChanged><Dashboard /></RequirePasswordChanged>} />
      <Route path="/reserve" element={<RequirePasswordChanged><StudyRooms /></RequirePasswordChanged>} />
      <Route path="/reserve/new" element={<RequirePasswordChanged><ReserveForm /></RequirePasswordChanged>} />
      <Route path="/profile" element={<RequirePasswordChanged><Profile /></RequirePasswordChanged>} />
      <Route path="/bookings" element={<RequirePasswordChanged><MyBookings /></RequirePasswordChanged>} />
      <Route path="/admin" element={<RequirePasswordChanged><AdminPanel /></RequirePasswordChanged>} />
      <Route path="/kiosk" element={<RequirePasswordChanged><Kiosk /></RequirePasswordChanged>} />  
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
