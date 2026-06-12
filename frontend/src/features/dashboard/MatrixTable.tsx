import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { MatrixResponse } from '@/types';
import { formatAmount, formatMonthKey } from '@/utils/format';
import styles from './MatrixTable.module.scss';

interface MatrixTableProps {
  data: MatrixResponse;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

/**
 * MatrixTable renders the month-over-month pivot exactly like the Excel sheet:
 *   - Block header rows, with their Line Items beneath
 *   - A subtotal row per block
 *   - The Summary engine block (Income, Expenditure, Balance, Investments, Liquid Savings)
 *   - A Remarks row at the very bottom
 * The first column is sticky so the wide month columns can scroll horizontally.
 */
export function MatrixTable({ data }: MatrixTableProps) {
  const { months, blocks, summary, remarks } = data;
  const navigate = useNavigate();

  // Summary rows config — drives both rendering and the semantic coloring.
  const summaryRows: {
    key: string;
    label: string;
    values: Record<string, number>;
    tone?: 'income' | 'balance' | 'invest' | 'savings';
    strong?: boolean;
  }[] = [
    { key: 'income', label: 'Total Income', values: summary.totalIncome, tone: 'income', strong: true },
    { key: 'expenditure', label: 'Total Expenditure', values: summary.totalExpenditure, strong: true },
    { key: 'investments', label: 'Total Investments', values: summary.totalInvestments, tone: 'invest' },
    { key: 'balance', label: 'Balance', values: summary.balance, tone: 'balance', strong: true },
  ];

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={`${styles.cornerCell} ${styles.stickyCol}`}>
              <span className={styles.cornerText}>Block / Line Item</span>
            </th>
            {months.map((m) => {
              const { label, year } = formatMonthKey(m);
              return (
                <th
                  key={m}
                  className={styles.monthHead}
                  role="button"
                  tabIndex={0}
                  title={`Open ${label} ${year} — view every transaction`}
                  onClick={() => navigate(`/month/${m}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/month/${m}`);
                    }
                  }}
                >
                  <span className={styles.monthLabel}>{label}</span>
                  <span className={styles.monthYear}>{year}</span>
                  <span className={styles.monthOpen} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        {blocks.map((block, bi) => (
          <motion.tbody
            key={block.blockId}
            className={styles.blockGroup}
            variants={fadeUp}
            custom={bi}
            initial="hidden"
            animate="visible"
          >
            {/* Block header row */}
            <tr className={styles.blockRow}>
              <td className={`${styles.blockLabel} ${styles.stickyCol}`}>
                <span
                  className={`${styles.blockTag} ${
                    block.blockType === 'INVESTMENT' ? styles.investTag : styles.expenseTag
                  }`}
                />
                {block.blockName}
              </td>
              {months.map((m) => (
                <td key={m} className={styles.blockSpacerCell} />
              ))}
            </tr>

            {/* Line item rows */}
            {block.rows.map((row) => (
              <tr key={row.lineItemId} className={styles.itemRow}>
                <td className={`${styles.itemLabel} ${styles.stickyCol}`}>
                  {row.lineItemName}
                </td>
                {months.map((m) => (
                  <td
                    key={m}
                    className={`${styles.amountCell} ${
                      row.cells[m] === 0 ? styles.emptyCell : ''
                    }`}
                  >
                    {formatAmount(row.cells[m] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </motion.tbody>
        ))}

        {/* Summary engine block */}
        <tbody className={styles.summaryGroup}>
          <tr className={styles.summaryHeaderRow}>
            <td className={`${styles.summaryHeader} ${styles.stickyCol}`}>
              Summary
            </td>
            {months.map((m) => (
              <td key={m} className={styles.summaryHeaderSpacer} />
            ))}
          </tr>
          {summaryRows.map((sr) => (
            <tr
              key={sr.key}
              className={`${styles.summaryRow} ${sr.strong ? styles.summaryStrong : ''}`}
            >
              <td className={`${styles.summaryLabel} ${styles.stickyCol}`}>
                {sr.label}
              </td>
              {months.map((m) => {
                const v = sr.values[m] ?? 0;
                const toneClass =
                  sr.tone === 'income'
                    ? styles.toneIncome
                    : sr.tone === 'invest'
                    ? styles.toneInvest
                    : (sr.tone === 'balance' || sr.tone === 'savings') && v < 0
                    ? styles.toneNegative
                    : sr.tone === 'balance' || sr.tone === 'savings'
                    ? styles.tonePositive
                    : '';
                return (
                  <td key={m} className={`${styles.summaryCell} ${toneClass}`}>
                    {formatAmount(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        {/* Remarks row */}
        <tbody className={styles.remarksGroup}>
          <tr className={styles.remarksRow}>
            <td className={`${styles.remarksLabel} ${styles.stickyCol}`}>
              Remarks
            </td>
            {months.map((m) => (
              <td key={m} className={styles.remarksCell}>
                {remarks[m] ? (
                  <pre className={styles.remarksText}>{remarks[m]}</pre>
                ) : (
                  <span className={styles.remarksEmpty}>—</span>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
