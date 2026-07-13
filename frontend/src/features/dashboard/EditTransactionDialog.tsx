import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  useGetBlocksQuery,
  useGetLineItemsQuery,
  useGetPaymentSourcesQuery,
  useUpdateTransactionMutation,
} from '@/api/client';
import type { MonthTransaction } from '@/types';
import styles from '@/features/transactions/QuickAddDialog.module.scss';

interface Props {
  transaction: MonthTransaction | null;
  onClose: () => void;
}

/** Edit an existing transaction. Reuses the Quick Add form layout/styles. */
export function EditTransactionDialog({ transaction, onClose }: Props) {
  const { data: blocks = [] } = useGetBlocksQuery();
  const { data: lineItems = [] } = useGetLineItemsQuery();
  const { data: paymentSources = [] } = useGetPaymentSourcesQuery();
  const [updateTransaction, { isLoading }] = useUpdateTransactionMutation();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [lineItemId, setLineItemId] = useState('');
  const [paymentSourceId, setPaymentSourceId] = useState('');
  const [description, setDescription] = useState('');

  // Hydrate the form whenever a different transaction is opened.
  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setDate(transaction.txnDate);
      setLineItemId(String(transaction.lineItemId));
      setPaymentSourceId(String(transaction.paymentSourceId));
      setDescription(transaction.description ?? '');
    }
  }, [transaction]);

  const amountNum = parseFloat(amount);
  const isValid =
    !Number.isNaN(amountNum) && amountNum > 0 && lineItemId && paymentSourceId && date;

  const handleSave = async () => {
    if (!isValid || !transaction) return;
    await updateTransaction({
      id: transaction.id,
      amount: amountNum,
      txnDate: date,
      lineItemId: Number(lineItemId),
      paymentSourceId: Number(paymentSourceId),
      description: description.trim() || undefined,
    }).unwrap();
    onClose();
  };

  return (
    <Modal open={transaction !== null} onClose={onClose} title="Edit transaction">
      <div className={styles.form}>
        <Input
          label="Amount (₹)"
          name="edit-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={amount}
          autoFocus
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          label="Date"
          name="edit-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        <Select
          label="Category (line item)"
          name="edit-line-item"
          value={lineItemId}
          onChange={(e) => setLineItemId(e.target.value)}
        >
          <option value="" disabled>
            Select a category…
          </option>
          {blocks.map((block) => {
            // Hide archived items, but keep the transaction's current category
            // selectable even if it has since been archived.
            const items = lineItems.filter(
              (li) =>
                li.blockId === block.id &&
                (!li.archived || li.id === Number(lineItemId))
            );
            if (items.length === 0) return null;
            return (
              <optgroup key={block.id} label={block.name}>
                {items.map((li) => (
                  <option key={li.id} value={li.id}>
                    {li.name}
                    {li.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </Select>

        <Select
          label="Payment source"
          name="edit-payment-source"
          value={paymentSourceId}
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
            name="edit-description"
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
            {isLoading ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
