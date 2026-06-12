import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  useGetBlocksQuery,
  useGetLineItemsQuery,
  useGetPaymentSourcesQuery,
  useCreateTransactionMutation,
} from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeQuickAdd } from '@/features/ui/uiSlice';
import { todayISO, formatAmount } from '@/utils/format';
import styles from './QuickAddDialog.module.scss';

/** Default the date to today, or to the opened month if that's a different one. */
function defaultDateFor(month: string | null): string {
  const today = todayISO();
  if (month && !today.startsWith(month)) return `${month}-01`;
  return today;
}

/**
 * Global Quick Add dialog. Mounted once in AppLayout and driven by the ui
 * slice (openQuickAdd/closeQuickAdd). Creating a transaction invalidates the
 * Transaction + Matrix tags, so the month screen and dashboard refresh on save.
 */
export function QuickAddDialog() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.quickAddOpen);
  const month = useAppSelector((s) => s.ui.quickAddMonth);

  const { data: blocks = [] } = useGetBlocksQuery();
  const { data: lineItems = [] } = useGetLineItemsQuery();
  const { data: paymentSources = [] } = useGetPaymentSourcesQuery();
  const [createTransaction, { isLoading }] = useCreateTransactionMutation();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [lineItemId, setLineItemId] = useState('');
  const [paymentSourceId, setPaymentSourceId] = useState('');
  const [description, setDescription] = useState('');
  const [justSaved, setJustSaved] = useState<string | null>(null);

  // Reset the date each time the dialog opens, honoring the opened month, and
  // default the payment source to Debit Card (falling back to the first source).
  useEffect(() => {
    if (open) {
      setDate(defaultDateFor(month));
      setJustSaved(null);
      const debit = paymentSources.find((p) => p.name.toLowerCase() === 'debit card');
      if (debit) setPaymentSourceId(String(debit.id));
    }
  }, [open, month, paymentSources]);

  const amountNum = parseFloat(amount);
  const isValid =
    !Number.isNaN(amountNum) && amountNum > 0 && lineItemId && paymentSourceId && date;

  const handleSave = async () => {
    if (!isValid) return;
    await createTransaction({
      amount: amountNum,
      txnDate: date,
      lineItemId: Number(lineItemId),
      paymentSourceId: Number(paymentSourceId),
      description: description.trim() || undefined,
    }).unwrap();
    const item = lineItems.find((li) => li.id === Number(lineItemId));
    setJustSaved(`Logged ₹${formatAmount(amountNum)} to ${item?.name ?? 'category'}.`);
    setAmount('');
    setDescription('');
  };

  const handleClose = () => {
    setAmount('');
    setDescription('');
    setLineItemId('');
    setPaymentSourceId('');
    dispatch(closeQuickAdd());
  };

  return (
    <Modal open={open} onClose={handleClose} title="Quick Add">
      <div className={styles.form}>
        <Input
          label="Amount (₹)"
          name="qa-amount"
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
          name="qa-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Select
          label="Category (line item)"
          name="qa-line-item"
          value={lineItemId}
          required
          onChange={(e) => setLineItemId(e.target.value)}
        >
          <option value="" disabled>
            Select a category…
          </option>
          {blocks.map((block) => {
            const items = lineItems.filter((li) => li.blockId === block.id);
            if (items.length === 0) return null;
            return (
              <optgroup key={block.id} label={block.name}>
                {items.map((li) => (
                  <option key={li.id} value={li.id}>
                    {li.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </Select>

        <Select
          label="Payment source"
          name="qa-payment-source"
          value={paymentSourceId}
          required
          onChange={(e) => setPaymentSourceId(e.target.value)}
        >
          <option value="" disabled>
            Select a source…
          </option>
          {paymentSources.map((ps) => (
            <option key={ps.id} value={ps.id}>
              {ps.name}
            </option>
          ))}
        </Select>

        <div className={styles.full}>
          <Input
            label="Note (optional)"
            name="qa-description"
            placeholder="e.g. Monthly rent, grocery run…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        <div className={styles.actions}>
          {justSaved && (
            <motion.span
              className={styles.saved}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
            >
              ✓ {justSaved}
            </motion.span>
          )}
          <Button variant="ghost" onClick={handleClose}>
            Done
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!isValid || isLoading}>
            {isLoading ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
