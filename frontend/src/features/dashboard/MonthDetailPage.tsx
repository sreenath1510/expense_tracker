import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  useGetMatrixQuery,
  useGetTransactionsByMonthQuery,
  useGetIncomeByMonthQuery,
  useGetPaymentSourcesQuery,
  useGetBudgetsQuery,
  useDeleteTransactionMutation,
  useDeleteIncomeEntryMutation,
} from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton, EditIcon, DeleteIcon } from '@/components/ui/IconButton';
import { BarChart } from '@/components/charts/BarChart';
import { CountUp } from '@/components/ui/CountUp';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openQuickAdd, setBlockOrder } from '@/features/ui/uiSlice';
import { formatAmount, formatMonthKey, formatLedgerDate } from '@/utils/format';
import { effectiveBudget } from '@/utils/budgets';
import type { MonthTransaction } from '@/types';
import { EditTransactionDialog } from './EditTransactionDialog';
import { AddIncomeDialog } from './AddIncomeDialog';
import { BudgetDialog } from './BudgetDialog';
import styles from './MonthDetailPage.module.scss';

interface Group {
  blockId: number;
  name: string;
  type: string;
  rows: MonthTransaction[];
  subtotal: number;
}

export function MonthDetailPage() {
  const { monthKey = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const blockOrder = useAppSelector((s) => s.ui.blockOrder);

  const { data: matrix, isLoading: matrixLoading } = useGetMatrixQuery();
  const { data: txns = [], isLoading: txnLoading } = useGetTransactionsByMonthQuery(monthKey);
  const { data: income = [] } = useGetIncomeByMonthQuery(monthKey);
  const { data: paymentSources = [] } = useGetPaymentSourcesQuery();
  const { data: budgets = [] } = useGetBudgetsQuery();
  const [deleteTransaction] = useDeleteTransactionMutation();
  const [deleteIncome] = useDeleteIncomeEntryMutation();

  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState(''); // '' = all payment sources
  const [sortMode, setSortMode] = useState<'custom' | 'desc' | 'asc'>('custom');
  const [expanded, setExpanded] = useState<Set<number>>(new Set()); // collapsed by default
  const [incomeExpanded, setIncomeExpanded] = useState(false);
  const [editing, setEditing] = useState<MonthTransaction | null>(null);
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);
  const [budgetEditing, setBudgetEditing] = useState<{ id: number; name: string } | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null);

  // Filter by free-text query and (optionally) a single payment source.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const src = sourceFilter ? Number(sourceFilter) : null;
    return txns.filter((t) => {
      if (src !== null && t.paymentSourceId !== src) return false;
      if (!q) return true;
      return (
        t.lineItemName.toLowerCase().includes(q) ||
        t.blockName.toLowerCase().includes(q) ||
        t.paymentSourceName.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [txns, query, sourceFilter]);

  // Group by block, then order by sort mode (or the persisted drag order).
  const groups = useMemo<Group[]>(() => {
    const map = new Map<number, Group>();
    for (const t of filtered) {
      if (!map.has(t.blockId)) {
        map.set(t.blockId, {
          blockId: t.blockId,
          name: t.blockName,
          type: t.blockType,
          rows: [],
          subtotal: 0,
        });
      }
      const g = map.get(t.blockId)!;
      g.rows.push(t);
      g.subtotal += t.amount;
    }
    const arr = [...map.values()];
    if (sortMode === 'desc') {
      arr.sort((a, b) => b.subtotal - a.subtotal);
    } else if (sortMode === 'asc') {
      arr.sort((a, b) => a.subtotal - b.subtotal);
    } else {
      arr.sort((a, b) => {
        const ia = blockOrder.indexOf(a.blockId);
        const ib = blockOrder.indexOf(b.blockId);
        if (ia === -1 && ib === -1) return a.blockId - b.blockId;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    }
    return arr;
  }, [filtered, blockOrder, sortMode]);

  const { label, year } = formatMonthKey(monthKey);
  const filteredTotal = filtered.reduce((s, t) => s + t.amount, 0);
  const incomeTotal = income.reduce((s, e) => s + e.amount, 0);
  const sourceName = sourceFilter
    ? paymentSources.find((p) => p.id === Number(sourceFilter))?.name ?? ''
    : '';

  const summary = matrix?.summary;
  const stats = summary
    ? [
        { key: 'income', label: 'Income', value: summary.totalIncome[monthKey] ?? 0, tone: 'income' as const },
        { key: 'exp', label: 'Expenditure', value: summary.totalExpenditure[monthKey] ?? 0, tone: 'neutral' as const },
        { key: 'balance', label: 'Balance', value: summary.balance[monthKey] ?? 0, tone: 'balance' as const },
        { key: 'invest', label: 'Investments', value: summary.totalInvestments[monthKey] ?? 0, tone: 'invest' as const },
      ]
    : [];

  const monthValid = matrixLoading || (matrix?.months.includes(monthKey) ?? false);
  const loading = matrixLoading || txnLoading;

  // Per-block actual (full month) + effective budget, for progress bars + chart.
  const blockBudget = (blockId: number) => effectiveBudget(budgets, blockId, monthKey);
  const blockActual = (blockId: number) =>
    matrix?.blocks.find((b) => b.blockId === blockId)?.subtotals[monthKey] ?? 0;

  // Budget vs Actual chart — blocks that have a budget set or any spend.
  const budgetChart = (matrix?.blocks ?? [])
    .map((b) => ({
      label: b.blockName,
      budget: blockBudget(b.blockId) ?? 0,
      actual: b.subtotals[monthKey] ?? 0,
    }))
    .filter((b) => b.budget > 0 || b.actual > 0);

  const toggle = (blockId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(blockId) ? next.delete(blockId) : next.add(blockId);
      return next;
    });

  const handleDrop = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const order = groups.map((g) => g.blockId);
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    if (from === -1 || to === -1) return;
    order.splice(to, 0, order.splice(from, 1)[0]);
    dispatch(setBlockOrder(order));
    setDragId(null);
  };

  const handleDelete = (t: MonthTransaction) => {
    setConfirm({
      message: `Delete this ₹${formatAmount(t.amount)} ${t.lineItemName} transaction? This can't be undone.`,
      action: () => deleteTransaction(t.id),
    });
  };

  const handleDeleteGroup = (group: Group) => {
    setConfirm({
      message: `Delete all ${group.rows.length} ${group.name} transaction(s) in ${label} ${year}? This can't be undone.`,
      action: () => group.rows.forEach((r) => deleteTransaction(r.id)),
    });
  };

  return (
    <div>
      <PageHeader
        label="Month detail"
        title={
          <>
            {label} <span className="gradient-text">{year}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/year/${year}`)}>
              ← {year}
            </Button>
            <Button variant="primary" onClick={() => dispatch(openQuickAdd(monthKey))}>
              + Quick Add
            </Button>
          </>
        }
      />

      {!monthValid ? (
        <Card className={styles.empty}>
          <p>
            No data for <strong>{monthKey || 'that month'}</strong>. Head back to the{' '}
            <Link to="/">dashboard</Link> and pick a month column.
          </p>
        </Card>
      ) : (
        <>
          {/* Month headline stats from the summary engine */}
          <div className={styles.statGrid}>
            {stats.map((s, i) => (
              <motion.div
                key={s.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className={styles.statCard}>
                  <span className={styles.statLabel}>
                    {s.label}
                    {s.key === 'income' && (
                      <button
                        className={styles.statAdd}
                        onClick={() => setAddIncomeOpen(true)}
                        title="Add income"
                        aria-label="Add income"
                      >
                        +
                      </button>
                    )}
                  </span>
                  <span className={`${styles.statValue} ${styles[s.tone]}`}>
                    ₹<CountUp value={s.value} format={formatAmount} />
                  </span>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Budget vs Actual for the month */}
          {budgetChart.length > 0 && (
            <Card className={styles.budgetChartCard}>
              <h3 className={styles.budgetChartTitle}>Budget vs Actual</h3>
              <BarChart
                groups={budgetChart.map((b) => ({ label: b.label, values: [b.budget, b.actual] }))}
                series={[
                  { label: 'Budget', color: '#94a3b8' },
                  { label: 'Actual', color: '#0052ff' },
                ]}
              />
            </Card>
          )}

          {/* search · filter · sort · count/source · total — one row */}
          <div className={styles.toolbar}>
            <div className={styles.search}>
              <Input
                name="search"
                placeholder="Filter by category or note…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select
              compact
              aria-label="Filter by payment source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="">All sources</option>
              {paymentSources.map((ps) => (
                <option key={ps.id} value={ps.id}>
                  {ps.name}
                </option>
              ))}
            </Select>
            <Select
              compact
              aria-label="Sort groups"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as 'custom' | 'desc' | 'asc')}
            >
              <option value="custom">Custom order</option>
              <option value="desc">Total: High → Low</option>
              <option value="asc">Total: Low → High</option>
            </Select>
            <span className={styles.summaryMeta}>
              {filtered.length} txns{sourceName && ` · ${sourceName}`}
            </span>
            <span className={styles.summaryAmount}>₹{formatAmount(filteredTotal)}</span>
          </div>

          {/* Income group (pinned at top) */}
          {income.length > 0 && (
            <Card padded={false} className={`${styles.groupCard} ${styles.incomeCard}`}>
              <div className={`${styles.groupHeader} ${styles.incomeHeader}`}>
                <button
                  className={styles.groupToggle}
                  onClick={() => setIncomeExpanded((v) => !v)}
                >
                  <svg
                    className={`${styles.caret} ${incomeExpanded ? styles.caretOpen : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  >
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className={`${styles.dot} ${styles.incomeDot}`} />
                  Income
                  <span className={styles.countPill}>{income.length}</span>
                </button>
                <div className={styles.groupHeaderRight}>
                  <span className={`${styles.groupSubtotal} ${styles.incomePos}`}>
                    +₹{formatAmount(incomeTotal)}
                  </span>
                </div>
              </div>
              {incomeExpanded && (
                <table className={styles.table}>
                  <tbody>
                    {income.map((e) => (
                      <tr key={e.id}>
                        <td className={styles.date}>{formatLedgerDate(e.entryDate)}</td>
                        <td className={styles.category}>{e.incomeSourceName}</td>
                        <td className={styles.note}>{e.description ?? '—'}</td>
                        <td className={`${styles.right} ${styles.amount} ${styles.incomePos}`}>
                          +₹{formatAmount(e.amount)}
                        </td>
                        <td className={styles.rowActions}>
                          <IconButton
                            label="Delete income"
                            variant="danger"
                            onClick={() =>
                              setConfirm({
                                message: `Delete this ₹${formatAmount(e.amount)} ${e.incomeSourceName} income entry?`,
                                action: () => deleteIncome(e.id),
                              })
                            }
                          >
                            <DeleteIcon />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}

          {loading ? (
            <Card className={styles.empty}>
              <p>Loading transactions…</p>
            </Card>
          ) : groups.length === 0 ? (
            <Card className={styles.empty}>
              <p>{query ? `No transactions match “${query}”.` : 'No transactions this month yet.'}</p>
            </Card>
          ) : (
            groups.map((group) => {
              const isOpen = expanded.has(group.blockId);
              const budget = blockBudget(group.blockId);
              const actual = blockActual(group.blockId);
              const ratio = budget && budget > 0 ? actual / budget : 0;
              const budgetClass =
                ratio > 1 ? styles.over : ratio >= 0.85 ? styles.near : styles.under;
              return (
                <div
                  key={group.blockId}
                  draggable={sortMode === 'custom'}
                  onDragStart={() => sortMode === 'custom' && setDragId(group.blockId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(group.blockId)}
                  className={`${styles.groupWrap} ${dragId === group.blockId ? styles.dragging : ''}`}
                >
                  <Card padded={false} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <button
                        className={styles.groupToggle}
                        onClick={() => toggle(group.blockId)}
                      >
                        {sortMode === 'custom' && (
                          <span className={styles.grip} aria-hidden="true">⠿</span>
                        )}
                        <svg
                          className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        >
                          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span
                          className={`${styles.dot} ${
                            group.type === 'INVESTMENT' ? styles.invest : styles.expense
                          }`}
                        />
                        {group.name}
                        <span className={styles.countPill}>{group.rows.length}</span>
                      </button>
                      <div className={styles.groupHeaderRight}>
                        <button
                          className={`${styles.budgetChip} ${budget != null ? budgetClass : ''}`}
                          onClick={() => setBudgetEditing({ id: group.blockId, name: group.name })}
                          title={budget != null ? 'Edit budget' : 'Set a budget'}
                        >
                          {budget != null ? `of ₹${formatAmount(budget)}` : '+ budget'}
                        </button>
                        <span className={styles.groupSubtotal}>₹{formatAmount(group.subtotal)}</span>
                        <IconButton
                          label={`Delete all ${group.name} transactions`}
                          variant="danger"
                          onClick={() => handleDeleteGroup(group)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </div>
                    </div>

                    {budget != null && (
                      <div className={styles.budgetTrack}>
                        <div
                          className={`${styles.budgetFill} ${budgetClass}`}
                          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                        />
                      </div>
                    )}

                    {isOpen && (
                      <table className={styles.table}>
                        <tbody>
                          {group.rows.map((t) => (
                            <tr key={t.id}>
                              <td className={styles.date}>{formatLedgerDate(t.txnDate)}</td>
                              <td className={styles.category}>{t.lineItemName}</td>
                              <td>
                                <span className={styles.source}>{t.paymentSourceName}</span>
                              </td>
                              <td className={styles.note}>{t.description ?? '—'}</td>
                              <td className={`${styles.right} ${styles.amount}`}>
                                ₹{formatAmount(t.amount)}
                              </td>
                              <td className={styles.rowActions}>
                                <IconButton label="Edit transaction" onClick={() => setEditing(t)}>
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  label="Delete transaction"
                                  variant="danger"
                                  onClick={() => handleDelete(t)}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </div>
              );
            })
          )}
        </>
      )}

      <EditTransactionDialog transaction={editing} onClose={() => setEditing(null)} />
      <AddIncomeDialog open={addIncomeOpen} month={monthKey} onClose={() => setAddIncomeOpen(false)} />
      <BudgetDialog
        block={budgetEditing}
        monthKey={monthKey}
        defaultAmount={budgetEditing ? blockBudget(budgetEditing.id) : null}
        onClose={() => setBudgetEditing(null)}
      />
      <ConfirmDialog
        open={confirm !== null}
        message={confirm?.message ?? ''}
        onConfirm={() => confirm?.action()}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
