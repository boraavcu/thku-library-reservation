import AdminPanel from './pages/AdminPanel';
import Kiosk from './pages/Kiosk';
import MyBookings from './pages/MyBookings';
import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSession } from 'next-auth/react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RulesAcceptance from './pages/RulesAcceptance';
import StudyRooms from './pages/StudyRooms';
import ReserveForm from './pages/ReserveForm';
import Profile from './pages/Profile';

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
      <Route path="/rules" element={<RulesAcceptance />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/reserve" element={<StudyRooms />} />
      <Route path="/reserve/new" element={<ReserveForm />} />
      <Route path="/profile" element={<Profile />} />
      {/* <Route path="/bookings" element={<Dashboard />} />
      <Route element={<MyBookings />} path="/bookings" />*/}
      <Route path="/bookings" element={<MyBookings />} />
      <Route path="/admin" element={<AdminPanel />} />
      <Route path="/kiosk" element={<Kiosk />} />  
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;