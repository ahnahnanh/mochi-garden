import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './styles.css';
import { AuthProvider, ToastProvider, useAuth } from './state.jsx';
import { Sprites } from './art.jsx';
import { Loading, Shell } from './components.jsx';
import Auth from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Dose from './pages/Dose.jsx';
import Garden from './pages/Garden.jsx';
import Community from './pages/Community.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import Help from './pages/Help.jsx';
import { MedicationForm, MedicationList } from './pages/Medications.jsx';

function Private({ children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return <Shell tabs={false}><Loading /></Shell>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

function Public({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <Shell tabs={false}><Loading /></Shell>;
  return user ? <Navigate to="/" replace /> : children;
}

const p = (el) => <Private>{el}</Private>;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Sprites />
          <Routes>
            <Route path="/login" element={<Public><Auth mode="login" /></Public>} />
            <Route path="/register" element={<Public><Auth mode="register" /></Public>} />
            <Route path="/" element={p(<Home />)} />
            <Route path="/dose/:scheduleId" element={p(<Dose />)} />
            <Route path="/garden" element={p(<Garden />)} />
            <Route path="/community" element={p(<Community />)} />
            <Route path="/profile" element={p(<Profile />)} />
            <Route path="/settings" element={p(<Settings />)} />
            <Route path="/help" element={p(<Help />)} />
            <Route path="/medications" element={p(<MedicationList />)} />
            <Route path="/medications/new" element={p(<MedicationForm />)} />
            <Route path="/medications/:id" element={p(<MedicationForm />)} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
