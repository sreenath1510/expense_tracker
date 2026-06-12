import { PageHeader } from '@/components/layout/PageHeader';
import { CategoryManager } from './CategoryManager';
import { SimpleListManager } from './SimpleListManager';
import {
  useGetPaymentSourcesQuery,
  useCreatePaymentSourceMutation,
  useUpdatePaymentSourceMutation,
  useDeletePaymentSourceMutation,
  useGetIncomeSourcesQuery,
  useCreateIncomeSourceMutation,
  useUpdateIncomeSourceMutation,
  useDeleteIncomeSourceMutation,
} from '@/api/client';
import styles from './SettingsPage.module.scss';

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        label="Settings"
        title={
          <>
            Make it <span className="gradient-text">yours</span>
          </>
        }
        description="Everything here is dynamic — create the exact blocks, line items, and sources that match how you track money."
      />

      {/* Sources first — short, stable lists */}
      <div className={styles.sources}>
        <PaymentSourcesManager />
        <IncomeSourcesManager />
      </div>

      {/* Blocks & line items below — this list keeps growing */}
      <div className={styles.categories}>
        <CategoryManager />
      </div>
    </div>
  );
}

// --- Payment sources --------------------------------------------------------
function PaymentSourcesManager() {
  const { data = [], isLoading } = useGetPaymentSourcesQuery();
  const [create] = useCreatePaymentSourceMutation();
  const [update] = useUpdatePaymentSourceMutation();
  const [remove] = useDeletePaymentSourceMutation();

  return (
    <SimpleListManager
      title="Payment Sources"
      description="How transactions are funded — Credit Card, Debit, Cash, UPI…"
      items={data}
      isLoading={isLoading}
      onCreate={(name) => create({ name })}
      onUpdate={(id, name) => update({ id, name })}
      onDelete={(id) => remove(id)}
    />
  );
}

// --- Income sources ---------------------------------------------------------
function IncomeSourcesManager() {
  const { data = [], isLoading } = useGetIncomeSourcesQuery();
  const [create] = useCreateIncomeSourceMutation();
  const [update] = useUpdateIncomeSourceMutation();
  const [remove] = useDeleteIncomeSourceMutation();

  return (
    <SimpleListManager
      title="Income Sources"
      description="Where money comes in — Salary, Reimbursements, Other. These feed Total Income."
      items={data}
      isLoading={isLoading}
      onCreate={(name) => create({ name })}
      onUpdate={(id, name) => update({ id, name })}
      onDelete={(id) => remove(id)}
    />
  );
}
