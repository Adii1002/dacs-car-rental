import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import MainLayout from './components/MainLayout';
import { RequireRole } from './components/ui';
import HomePage from './pages/HomePage';
import CarsPage from './pages/CarsPage';
import BookPage from './pages/BookPage';
import BookingDetailPage from './pages/BookingDetailPage';
import MyBookingsPage from './pages/MyBookingsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import { OwnerLayout, OwnerOverview, OwnerCars, OwnerBookings } from './pages/owner/OwnerPages';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminBookings from './pages/admin/AdminBookings';
import AdminCars from './pages/admin/AdminCars';
import AdminOwners from './pages/admin/AdminOwners';
import { AdminCustomers, AdminNotifications, AdminSettings } from './pages/admin/AdminMisc';

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage mode="login" />} />
            <Route path="/register" element={<LoginPage mode="register" />} />

            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="cars" element={<CarsPage />} />
              <Route path="cars/:carId" element={<BookPage />} />
              <Route path="book/:carId" element={<BookPage />} />
              <Route path="booking/:id" element={<RequireRole><BookingDetailPage /></RequireRole>} />
              <Route path="my-bookings" element={<RequireRole><MyBookingsPage /></RequireRole>} />
              <Route path="profile" element={<RequireRole><ProfilePage /></RequireRole>} />
            </Route>

            <Route path="/owner" element={<RequireRole roles={['owner']}><OwnerLayout /></RequireRole>}>
              <Route index element={<OwnerOverview />} />
              <Route path="cars" element={<OwnerCars />} />
              <Route path="bookings" element={<OwnerBookings />} />
            </Route>

            <Route path="/admin" element={<RequireRole roles={['admin']}><AdminLayout /></RequireRole>}>
              <Route index element={<AdminOverview />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="cars" element={<AdminCars />} />
              <Route path="owners" element={<AdminOwners />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  );
}
