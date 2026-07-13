import { useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IconButton, DeleteIcon } from '@/components/ui/IconButton';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  loadParsedRows,
  setRowAmount,
  setAllLineItems,
  setAllPaymentSources,
  setLineItemForRows,
  setPaymentSourceForRows,
  removeRow,
  clearUpload,
} from './uploadSlice';
import {
  useGetBlocksQuery,
  useGetLineItemsQuery,
  useGetPaymentSourcesQuery,
  useBatchCreateTransactionsMutation,
} from '@/api/client';
import { parseStatementFile } from './parseStatement';
import { formatLedgerDate } from '@/utils/format';
import styles from './BulkUploadPage.module.scss';

export function BulkUploadPage() {
  const dispatch = useAppDispatch();
  const rows = useAppSelector((s) => s.upload.rows);

  const { data: blocks = [] } = useGetBlocksQuery();
  const { data: lineItems = [] } = useGetLineItemsQuery();
  // New spend can't be booked against archived categories.
  const activeLineItems = lineItems.filter((li) => !li.archived);
  const { data: paymentSources = [] } = useGetPaymentSourcesQuery();
  const [batchSave, { isLoading: saving }] = useBatchCreateTransactionsMutation();

  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [parsing, setParsing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = (rowId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(rowId) ? next.delete(rowId) : next.add(rowId);
      return next;
    });

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.rowId)));

  // When a selected row's dropdown changes, apply to every selected row;
  // otherwise just that row. This is the "tick 10 cab rows, set one → all" flow.
  const targetsFor = (rowId: string) =>
    selected.has(rowId) && selected.size > 1 ? [...selected] : [rowId];

  const handleFile = async (file: File) => {
    setParseError(null);
    setSavedCount(null);
    setParsing(true);
    try {
      const parsed = await parseStatementFile(file);
      if (parsed.length === 0) {
        const isPdf =
          file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        setParseError(
          isPdf
            ? "Couldn't find any transactions in that PDF. It may be a scanned/image-only statement with no text layer, or an unusual layout — try the CSV export instead."
            : 'No rows found. Expected a date, an amount, and a description column.',
        );
        return;
      }
      dispatch(loadParsedRows(parsed));
      setFileName(file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse the file.');
    } finally {
      setParsing(false);
    }
  };

  const mappedCount = rows.filter((r) => r.lineItemId && r.paymentSourceId).length;
  const allMapped = rows.length > 0 && mappedCount === rows.length;

  const handleSaveAll = async () => {
    const ready = rows.filter((r) => r.lineItemId && r.paymentSourceId);
    if (ready.length === 0) return;
    const res = await batchSave(
      ready.map((r) => ({
        txnDate: r.date,
        amount: r.amount,
        lineItemId: r.lineItemId!,
        paymentSourceId: r.paymentSourceId!,
        description: r.description,
      })),
    ).unwrap();
    setSavedCount(res.inserted ?? ready.length);
    dispatch(clearUpload());
    setFileName(null);
    setSelected(new Set());
  };

  const handleDiscard = () => {
    dispatch(clearUpload());
    setFileName(null);
    setSelected(new Set());
  };

  return (
    <div>
      <PageHeader
        label="Bulk Upload"
        title={
          <>
            Import a <span className="gradient-text">statement</span>
          </>
        }
        description="Drop in a CSV or PDF bank/card statement. We parse the rows — you map each one to a category and payment source, fix anything mis-read, then save everything in one go."
        actions={
          rows.length > 0 ? (
            <Button variant="secondary" onClick={handleDiscard}>
              Discard
            </Button>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <Card className={styles.dropCard}>
          <div
            className={styles.dropzone}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            role="button"
            tabIndex={0}
          >
            <div className={styles.dropIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 16V4M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" strokeLinecap="round" />
              </svg>
            </div>
            <p className={styles.dropText}>
              {parsing ? (
                <strong>Parsing…</strong>
              ) : (
                <>
                  <strong>Click to choose</strong> or drag a CSV or PDF file here
                </>
              )}
            </p>
            <p className={styles.dropHint}>
              CSV needs a date, an amount, and a description column. PDF statements
              are read automatically — check the parsed rows before saving.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,.pdf,application/pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          {parseError && <p className={styles.error}>{parseError}</p>}
          {savedCount !== null && (
            <p className={styles.success}>
              ✓ Saved {savedCount} transaction{savedCount === 1 ? '' : 's'}. They’ll appear on the
              dashboard.
            </p>
          )}
        </Card>
      ) : (
        <>
          {/* Bulk-map shortcuts + progress */}
          <Card className={styles.toolbar}>
            <div className={styles.toolbarInfo}>
              <span className={styles.fileName}>{fileName}</span>
              <span className={styles.progress}>
                {mappedCount} of {rows.length} mapped
              </span>
              {selected.size > 0 && (
                <span className={styles.selectedPill}>
                  {selected.size} selected — set a dropdown to apply to all
                </span>
              )}
            </div>
            <div className={styles.bulkActions}>
              <Select
                compact
                aria-label="Set all categories"
                defaultValue=""
                onChange={(e) => e.target.value && dispatch(setAllLineItems(Number(e.target.value)))}
              >
                <option value="" disabled>
                  Set all categories…
                </option>
                {blocks.map((block) => {
                  const items = activeLineItems.filter((li) => li.blockId === block.id);
                  if (!items.length) return null;
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
                compact
                aria-label="Set all payment sources"
                defaultValue=""
                onChange={(e) =>
                  e.target.value && dispatch(setAllPaymentSources(Number(e.target.value)))
                }
              >
                <option value="" disabled>
                  Set all sources…
                </option>
                {paymentSources.map((ps) => (
                  <option key={ps.id} value={ps.id}>
                    {ps.name}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          {/* The interactive mapping table */}
          <Card padded={false} className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <colgroup>
                  <col className={styles.colCheck} />
                  <col className={styles.colDate} />
                  <col className={styles.colAmount} />
                  <col className={styles.colDesc} />
                  <col className={styles.colCat} />
                  <col className={styles.colSrc} />
                  <col className={styles.colActions} />
                </colgroup>
                <thead>
                  <tr>
                    <th className={styles.center}>
                      <input
                        type="checkbox"
                        className={styles.check}
                        aria-label="Select all rows"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Date</th>
                    <th className={styles.right}>Amount</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Payment Source</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isMapped = row.lineItemId && row.paymentSourceId;
                    const isSelected = selected.has(row.rowId);
                    return (
                      <tr
                        key={row.rowId}
                        className={`${isMapped ? styles.mappedRow : ''} ${
                          isSelected ? styles.selectedRow : ''
                        }`}
                      >
                        <td className={styles.center}>
                          <input
                            type="checkbox"
                            className={styles.check}
                            aria-label={`Select ${row.description}`}
                            checked={isSelected}
                            onChange={() => toggleSelected(row.rowId)}
                          />
                        </td>
                        <td className={styles.dateCell}>{formatLedgerDate(row.date)}</td>
                        <td className={styles.right}>
                          <div className={styles.amountField}>
                            <span className={styles.rupee}>₹</span>
                            <input
                              className={`${styles.cellInput} ${styles.amountInput}`}
                              aria-label={`Amount for ${row.description}`}
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={row.amount || ''}
                              onChange={(e) =>
                                dispatch(
                                  setRowAmount({
                                    rowId: row.rowId,
                                    amount: parseFloat(e.target.value) || 0,
                                  }),
                                )
                              }
                            />
                          </div>
                        </td>
                        <td className={styles.descCell} title={row.description}>
                          {row.description || '—'}
                        </td>
                        <td>
                          <Select
                            compact
                            aria-label={`Category for ${row.description}`}
                            value={row.lineItemId ?? ''}
                            onChange={(e) =>
                              dispatch(
                                setLineItemForRows({
                                  rowIds: targetsFor(row.rowId),
                                  lineItemId: e.target.value ? Number(e.target.value) : null,
                                }),
                              )
                            }
                          >
                            <option value="">—</option>
                            {blocks.map((block) => {
                              const items = activeLineItems.filter(
                                (li) => li.blockId === block.id,
                              );
                              if (!items.length) return null;
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
                        </td>
                        <td>
                          <Select
                            compact
                            aria-label={`Payment source for ${row.description}`}
                            value={row.paymentSourceId ?? ''}
                            onChange={(e) =>
                              dispatch(
                                setPaymentSourceForRows({
                                  rowIds: targetsFor(row.rowId),
                                  paymentSourceId: e.target.value ? Number(e.target.value) : null,
                                }),
                              )
                            }
                          >
                            <option value="">—</option>
                            {paymentSources.map((ps) => (
                              <option key={ps.id} value={ps.id}>
                                {ps.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <IconButton
                            label="Remove row"
                            variant="danger"
                            onClick={() => dispatch(removeRow(row.rowId))}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className={styles.saveBar}>
              <span className={styles.saveHint}>
                {allMapped
                  ? 'All rows mapped — ready to save.'
                  : `${rows.length - mappedCount} row(s) still need a category and source. Unmapped rows are skipped.`}
              </span>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSaveAll}
                disabled={mappedCount === 0 || saving}
              >
                {saving ? 'Saving…' : `Save ${mappedCount} transaction${mappedCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
