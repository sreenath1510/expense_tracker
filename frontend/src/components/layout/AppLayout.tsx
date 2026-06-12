import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { QuickAddDialog } from '@/features/transactions/QuickAddDialog';
import styles from './AppLayout.module.scss';

/** Shell layout: persistent sidebar + scrollable content area for routes. */
export function AppLayout() {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
      {/* Global Quick Add dialog — opened from the sidebar, dashboard, or a month. */}
      <QuickAddDialog />
    </div>
  );
}
