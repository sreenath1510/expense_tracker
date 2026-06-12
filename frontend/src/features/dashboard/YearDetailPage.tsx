import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGetMatrixQuery, useGetBudgetsQuery } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TrendChart } from '@/components/charts/TrendChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { CountUp } from '@/components/ui/CountUp';
import { MatrixTable } from './MatrixTable';
import { useAppDispatch } from '@/store/hooks';
import { openQuickAdd } from '@/features/ui/uiSlice';
import {
  getYearSummaries,
  getMonthlySeries,
  getBlockBreakdown,
  sliceMatrixByYear,
} from '@/utils/yearly';
import { annualBudget } from '@/utils/budgets';
import { formatAmount } from '@/utils/format';
import styles from './YearDetailPage.module.scss';

export function YearDetailPage() {
  const { year = '' } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data, isLoading } = useGetMatrixQuery();
  const { data: budgets = [] } = useGetBudgetsQuery();

  if (isLoading) {
    return <div className={styles.state}><div className={styles.spinner} /></div>;
  }
  const known = data?.months.some((m) => m.startsWith(year));
  if (!data || !known) {
    return (
      <Card className={styles.empty}>
        <p>
          No data for <strong>{year || 'that year'}</strong>. Back to the{' '}
          <Link to="/">overview</Link>.
        </p>
      </Card>
    );
  }

  const summary = getYearSummaries(data).find((y) => y.year === year)!;
  const series = getMonthlySeries(data, year);
  const breakdown = getBlockBreakdown(data, year);
  const yearMatrix = sliceMatrixByYear(data, year);

  // Annual budget vs actual per block (budget = carried-forward monthly sum).
  const budgetChart = data.blocks
    .map((b) => ({
      label: b.blockName,
      budget: annualBudget(budgets, b.blockId, summary.months),
      actual: summary.months.reduce((s, m) => s + (b.subtotals[m] ?? 0), 0),
    }))
    .filter((b) => b.budget > 0 || b.actual > 0);

  const stats = [
    { label: 'Income', value: summary.income, tone: 'pos' as const },
    { label: 'Expenditure', value: summary.expenditure, tone: 'neutral' as const },
    { label: 'Investments', value: summary.investments, tone: 'invest' as const },
    { label: 'Balance', value: summary.balance, tone: summary.balance < 0 ? 'neg' : 'accent' as const },
  ];

  return (
    <div>
      <PageHeader
        label="Year detail"
        title={
          <>
            Year <span className="gradient-text">{year}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/')}>
              ← Overview
            </Button>
            <Button variant="primary" onClick={() => dispatch(openQuickAdd())}>
              + Quick Add
            </Button>
          </>
        }
      />

      <div className={styles.statGrid}>
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className={styles.statCard}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={`${styles.statValue} ${styles[s.tone]}`}>
                ₹<CountUp value={s.value} format={formatAmount} />
              </span>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className={styles.chartRow}>
        <Card className={styles.trendCard}>
          <h3 className={styles.chartTitle}>Monthly trend</h3>
          <TrendChart
            labels={series.labels}
            series={[
              { label: 'Income', color: '#0f9d58', values: series.income, area: true },
              { label: 'Expenditure', color: '#0052ff', values: series.expenditure },
              { label: 'Investments', color: '#7c5cff', values: series.investments },
            ]}
          />
        </Card>
        <Card className={styles.donutCard}>
          <h3 className={styles.chartTitle}>Where it went</h3>
          <DonutChart
            data={breakdown.map((b) => ({ label: b.label, value: b.value }))}
            centerLabel="Outflow"
          />
        </Card>
      </div>

      {budgetChart.length > 0 && (
        <Card className={styles.budgetCard}>
          <h3 className={styles.chartTitle}>Budget vs Actual — {year} (annual)</h3>
          <BarChart
            groups={budgetChart.map((b) => ({ label: b.label, values: [b.budget, b.actual] }))}
            series={[
              { label: 'Budget', color: '#94a3b8' },
              { label: 'Actual', color: '#0052ff' },
            ]}
          />
        </Card>
      )}

      <h3 className={styles.matrixTitle}>Month-by-month breakdown</h3>
      <MatrixTable data={yearMatrix} />
    </div>
  );
}
