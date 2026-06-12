import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpsertBudgetMutation } from '@/api/client';
import { formatMonthKey } from '@/utils/format';
import styles from '@/features/transactions/QuickAddDialog.module.scss';

interface Props {
  block: { id: number; name: string } | null;
  monthKey: string;
  /** Carried-forward / current budget to prefill, or null if none. */
  defaultAmount: number | null;
  onClose: () => void;
}

/** Set or update a block's budget for a specific month. */
export function BudgetDialog({ block, monthKey, defaultAmount, onClose }: Props) {
  const [upsertBudget, { isLoading }] = useUpsertBudgetMutation();
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (block) setAmount(defaultAmount != null ? String(defaultAmount) : '');
  }, [block, defaultAmount]);

  const amountNum = parseFloat(amount);
  const isValid = !Number.isNaN(amountNum) && amountNum >= 0;
  const { label, year } = formatMonthKey(monthKey);

  const handleSave = async () => {
    if (!isValid || !block) return;
    const [y, m] = monthKey.split('-').map(Number);
    await upsertBudget({ blockId: block.id, year: y, month: m, amount: amountNum }).unwrap();
    onClose();
  };

  return (
    <Modal open={block !== null} onClose={onClose} title={`Budget — ${block?.name ?? ''}`}>
      <div className={styles.form}>
        <div className={styles.full}>
          <Input
            label={`Monthly budget for ${label} ${year} (₹)`}
            name="budget-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="100"
            placeholder="0"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        <p className={styles.hint}>
          Applies from {label} {year} onward until you change it in a later month.
        </p>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!isValid || isLoading}>
            {isLoading ? 'Saving…' : 'Save budget'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
