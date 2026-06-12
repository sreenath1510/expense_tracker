import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignUpPage } from '@/features/auth/SignUpPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { YearDetailPage } from '@/features/dashboard/YearDetailPage';
import { MonthDetailPage } from '@/features/dashboard/MonthDetailPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { BulkUploadPage } from '@/features/upload/BulkUploadPage';

export function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* Everything else requires a valid token */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="year/:year" element={<YearDetailPage />} />
          <Route path="month/:monthKey" element={<MonthDetailPage />} />
          <Route path="upload" element={<BulkUploadPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
