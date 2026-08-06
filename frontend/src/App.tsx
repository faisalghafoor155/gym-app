import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import Plans from './pages/Plans';
import Supplements from './pages/Supplements';
import Team from './pages/Team';
import MyPortal from './pages/MyPortal';

function Spinner() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuth, loading } = useAuth();
  if (loading) return <Spinner />;
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Owner or staff — the pages that run the gym. */
function StaffRoute({ children }: { children: ReactNode }) {
  const { isAuth, isStaff, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/my" replace />;
  return <>{children}</>;
}

/** Owner only — account management and ownership. */
function OwnerRoute({ children }: { children: ReactNode }) {
  const { isAuth, isOwner, isStaff, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isAuth) return <Navigate to="/login" replace />;
  if (!isOwner) return <Navigate to={isStaff ? '/dashboard' : '/my'} replace />;
  return <>{children}</>;
}

/** Members have no gym dashboard, so "/" means different things per role. */
function HomeRedirect() {
  const { isStaff, loading } = useAuth();
  if (loading) return <Spinner />;
  return <Navigate to={isStaff ? '/dashboard' : '/my'} replace />;
}

function AppRoutes() {
  const { isAuth } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={isAuth ? <HomeRedirect /> : <Login />} />
      <Route path="/register" element={isAuth ? <HomeRedirect /> : <Register />} />
      <Route path="/forgot-password" element={isAuth ? <HomeRedirect /> : <ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/my" element={<MyPortal />} />
                <Route path="/dashboard" element={<StaffRoute><Dashboard /></StaffRoute>} />
                <Route path="/attendance" element={<StaffRoute><Attendance /></StaffRoute>} />
                <Route path="/plans" element={<StaffRoute><Plans /></StaffRoute>} />
                <Route path="/supplements" element={<StaffRoute><Supplements /></StaffRoute>} />
                <Route path="/members" element={<StaffRoute><Members /></StaffRoute>} />
                <Route path="/payments" element={<StaffRoute><Payments /></StaffRoute>} />
                <Route path="/team" element={<OwnerRoute><Team /></OwnerRoute>} />
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
