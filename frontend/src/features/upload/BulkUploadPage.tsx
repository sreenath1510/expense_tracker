import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { IconButton, DeleteIcon } from '@/components/ui/IconButton';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  loadParsedRows,
  setRowAmount,
  setRowDate,
  setAllLineItems,
  setAllPaymentSources,
  setLineItemForRows,
  setPaymentSourceForRows,
  removeRow,
  removeRows,
  clearUpload,
} from './uploadSlice';
import { pushToast } from '@/features/ui/uiSlice';
import {
  useGetBlocksQuery,
  useGetLineItemsQuery,
  useGetPaymentSourcesQuery,
  useBatchCreateTransactionsMutation,
} from '@/api/client';
import { parseStatementFile } from './parseStatement';
import { isIsoDate } from './statementDate';
import { formatLedgerDate, formatMonthKey } from '@/utils/format';
import { periodMonths, periodLabel, periodRange } from '@/utils/period';
import styles from './BulkUploadPage.module.scss';

/** The period an import is scoped to, resolved from the `period` query param. */
interface ImportTarget {
  /** Every month key the import is expected to land in. */
  months: string[];
  /** "April 2026" or "FY 2025". */
  label: string;
  /** "Apr 2025 – Mar 2026" for a 12-month period; null for a single month. */
  range: string | null;
  /** First day of the target — the placeholder for unreadable dates. */
  anchorDate: string;
}

export function BulkUploadPage() {
  const dispatch = useAppDispatch();
  const rows = useAppSelector((s) => s.upload.rows);
  const periodMode = useAppSelector((s) => s.ui.periodMode);
  const [searchParams] = useSearchParams();

  // ?period=2026-04 imports into one month; ?period=2025 into a whole period,
  // read under the active calendar/fiscal mode. Anything else — or no param —
  // is an unscoped import, exactly as before.
  const periodParam = searchParams.get('period');
  const target = useMemo<ImportTarget | null>(() => {
    if (!periodParam) return null;
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(periodParam)) {
      const { label, year } = formatMonthKey(periodParam);
      return {
        months: [periodParam],
        label: `${label} ${year}`,
        range: null,
        anchorDate: `${periodParam}-01`,
      };
    }
    if (/^\d{4}$/.test(periodParam)) {
      const anchor = Number(periodParam);
      const months = periodMonths(anchor, periodMode);
      return {
        months,
        label: periodLabel(anchor, periodMode),
        range: periodRange(anchor, periodMode),
        anchorDate: `${months[0]}-01`,
      };
    }
    return null;
  }, [periodParam, periodMode]);

  const targetMonths = useMemo(() => new Set(target?.months ?? []), [target]);
  // A readable date outside the target window. Statements routinely straddle a
  // boundary, so this flags rather than blocks — the row still saves, into its
  // own month.
  const isOutsideTarget = (r: (typeof rows)[number]) =>
    target !== null && isIsoDate(r.date) && !targetMonths.has(r.date.slice(0, 7));

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
      dispatch(loadParsedRows({ rows: parsed, anchorDate: target?.anchorDate ?? null }));
      setFileName(file.name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse the file.');
    } finally {
      setParsing(false);
    }
  };

  // A row can only be saved once it's mapped AND its date parsed to a real
  // calendar date — the API's txnDate is a date, so an unreadable one would be
  // rejected for the whole batch.
  const isSavable = (r: (typeof rows)[number]) =>
    Boolean(r.lineItemId && r.paymentSourceId && isIsoDate(r.date));

  const mappedCount = rows.filter((r) => r.lineItemId && r.paymentSourceId).length;
  const badDateCount = rows.filter((r) => !isIsoDate(r.date)).length;
  const anchoredCount = rows.filter((r) => r.dateAnchored).length;
  const outsideCount = rows.filter(isOutsideTarget).length;
  const savableCount = rows.filter(isSavable).length;
  const allMapped = rows.length > 0 && mappedCount === rows.length;

  const handleSaveAll = async () => {
    const ready = rows.filter(isSavable);
    if (ready.length === 0) return;
    const savedIds = ready.map((r) => r.rowId);
    try {
      const res = await batchSave(
        ready.map((r) => ({
          txnDate: r.date,
          amount: r.amount,
          lineItemId: r.lineItemId!,
          paymentSourceId: r.paymentSourceId!,
          description: r.description,
        })),
      ).unwrap();
      const inserted = res.inserted ?? ready.length;
      const remaining = rows.length - savedIds.length;

      // Retire only what was banked. Everything still uncategorized stays on
      // the table so a long statement can be saved off in batches.
      dispatch(removeRows(savedIds));
      setSelected((prev) => {
        const next = new Set(prev);
        savedIds.forEach((id) => next.delete(id));
        return next;
      });
      setSavedCount((prev) => (prev ?? 0) + inserted);
      dispatch(
        pushToast({
          message:
            remaining > 0
              ? `Saved ${inserted} transaction${inserted === 1 ? '' : 's'} — ${remaining} row${remaining === 1 ? '' : 's'} left to categorize.`
              : `Saved ${inserted} transaction${inserted === 1 ? '' : 's'}.`,
          tone: 'success',
        }),
      );
      if (remaining === 0) setFileName(null);
    } catch {
      // The rows stay put on failure; the error toast comes from the middleware.
    }
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
        description="Drop in a CSV or PDF bank/card statement. We parse the rows — you map each one to a category and payment source, fix anything mis-read, and save as you go. Saved rows leave the table; the rest wait for you."
        actions={
          rows.length > 0 ? (
            <Button variant="secondary" onClick={handleDiscard}>
              Discard
            </Button>
          ) : undefined
        }
      />

      {/* Launched from a month or year screen — say where this is landing. */}
      {target && (
        <Card className={styles.targetBanner}>
          <span className={styles.targetDot} aria-hidden="true" />
          <div className={styles.targetText}>
            <strong>Importing into {target.label}</strong>
            {target.range && <span className={styles.targetRange}> · {target.range}</span>}
            <p className={styles.targetHint}>
              Rows dated outside {target.label} are flagged but still saved to their own
              month — statements rarely stop at a period boundary. Dates the parser
              couldn’t read start at {formatLedgerDate(target.anchorDate)}; check those.
            </p>
          </div>
        </Card>
      )}

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
              {savedCount !== null && savedCount > 0 && (
                <span className={styles.savedPill}>✓ {savedCount} saved</span>
              )}
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
                    const outside = isOutsideTarget(row);
                    // Anchored dates are placeholders, so they stay editable
                    // even though they're technically valid ISO.
                    const needsDate = !isIsoDate(row.date) || row.dateAnchored;
                    return (
                      <tr
                        key={row.rowId}
                        className={`${isMapped ? styles.mappedRow : ''} ${
                          isSelected ? styles.selectedRow : ''
                        } ${outside ? styles.outsideRow : ''}`}
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
                        <td className={styles.dateCell}>
                          {!needsDate ? (
                            <>
                              {formatLedgerDate(row.date)}
                              {outside && (
                                <span
                                  className={styles.outsideFlag}
                                  title={`Dated outside ${target?.label} — it'll still be saved, to its own month.`}
                                >
                                  outside
                                </span>
                              )}
                            </>
                          ) : (
                            // Couldn't read the statement's date — let the user
                            // set it here rather than fail the whole batch. When
                            // the import is period-scoped it's pre-filled with
                            // the target's first day, so the row is savable and
                            // the picker opens in the right month.
                            <input
                              className={`${styles.cellInput} ${styles.dateInput} ${
                                row.dateAnchored ? styles.dateAnchored : ''
                              }`}
                              type="date"
                              aria-label={`Date for ${row.description}`}
                              title={
                                row.dateAnchored
                                  ? `Couldn't read this row's date — anchored to ${target?.label}. Set the real one.`
                                  : `Couldn't read "${row.date}" — pick the date`
                              }
                              value={isIsoDate(row.date) ? row.date : ''}
                              onChange={(e) =>
                                dispatch(
                                  setRowDate({ rowId: row.rowId, date: e.target.value }),
                                )
                              }
                            />
                          )}
                        </td>
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
                {badDateCount > 0
                  ? `${badDateCount} row(s) have an unreadable date — set it in the Date column. They stay on the table.`
                  : anchoredCount > 0
                  ? `${anchoredCount} row(s) had no readable date and start at ${target?.label} — check the Date column before saving.`
                  : outsideCount > 0
                  ? `${outsideCount} row(s) fall outside ${target?.label}. They'll be saved to their own month.`
                  : allMapped
                  ? 'All rows mapped — ready to save.'
                  : `Save as you go — categorized rows are banked, the other ${rows.length - mappedCount} stay on the table.`}
              </span>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSaveAll}
                disabled={savableCount === 0 || saving}
              >
                {saving ? 'Saving…' : `Save ${savableCount} transaction${savableCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
