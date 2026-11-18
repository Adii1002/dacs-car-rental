import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, CalendarCheck, CarFront, UserCog, Users, Bell, Settings2 } from 'lucide-react';
import DashboardLayout from '../../components/DashboardLayout';
import { Spinner } from '../../components/ui';
import { api } from '../../api';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/admin/cars', label: 'Fleet', icon: CarFront },
  { to: '/admin/owners', label: 'Car owners', icon: UserCog },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/settings', label: 'Settings', icon: Settings2 }
];

export default function AdminLayout() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => api('/admin/overview').then(setData).catch(e => setError(e.message)), []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <DashboardLayout title="Admin panel" items={NAV}>
      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error ? <Spinner /> : data && <Outlet context={{ ...data, reload }} />}
    </DashboardLayout>
  );
}
