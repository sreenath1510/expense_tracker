import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useGetIncomeSourcesQuery, useCreateIncomeEntryMutation } from '@/api/client';
import { todayISO } from '@/utils/format';
import styles from '@/features/transactions/QuickAddDialog.module.scss';

interface Props {
  open: boolean;
  month: string; // YYYY-MM this dialog adds income into
  onClose: () => void;
}

function defaultDateFor(month: string): string {
  const today = todayISO();
  return today.startsWith(month) ? today : `${month}-01`;
}

/** Add an income entry for the given month. Refreshes the matrix on save. */
export function AddIncomeDialog({ open, month, onClose }: Props) {
  const { data: incomeSources = [] } = useGetIncomeSourcesQuery();
  const [createIncome, { isLoading }] = useCreateIncomeEntryMutation();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(defaultDateFor(month));
  const [incomeSourceId, setIncomeSourceId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setDate(defaultDateFor(month));
      setAmount('');
      setDescription('');
    }
  }, [open, month]);

  const amountNum = parseFloat(amount);
  const isValid = !Number.isNaN(amountNum) && amountNum > 0 && incomeSourceId && date;

  const handleSave = async () => {
    if (!isValid) return;
    await createIncome({
      amount: amountNum,
      entryDate: date,
      incomeSourceId: Number(incomeSourceId),
      description: description.trim() || undefined,
    }).unwrap();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add income">
      <div className={styles.form}>
        <Input
          label="Amount (₹)"
          name="inc-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          placeholder="0"
          value={amount}
          autoFocus
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <Input
          label="Date"
          name="inc-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Select
          label="Income source"
          name="inc-source"
          value={incomeSourceId}
          onChange={(e) => setIncomeSourceId(e.target.value)}
        >
          <option value="" disabled>
            Select a source…
          </option>
          {incomeSources.map((src) => (
            <option key={src.id} value={src.id}>
              {src.name}
            </option>
          ))}
        </Select>

        <div className={styles.full}>
          <Input
            label="Note (optional)"
            name="inc-description"
            placeholder="e.g. May salary, freelance invoice…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!isValid || isLoading}>
            {isLoading ? 'Saving…' : 'Add income'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
