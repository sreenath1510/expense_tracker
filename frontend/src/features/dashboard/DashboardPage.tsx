import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGetMatrixQuery } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BarChart } from '@/components/charts/BarChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { CountUp } from '@/components/ui/CountUp';
import { useAppDispatch } from '@/store/hooks';
import { openQuickAdd } from '@/features/ui/uiSlice';
import { getYearSummaries } from '@/utils/yearly';
import { formatAmount } from '@/utils/format';
import styles from './DashboardPage.module.scss';

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useGetMatrixQuery();

  if (isLoading) {
    return (
      <div className={styles.state}>
        <div className={styles.spinner} />
        <p>Loading your ledger…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.state}>
        <p>Couldn't load your data. Is the backend running?</p>
      </div>
    );
  }

  const years = getYearSummaries(data);

  return (
    <div>
      <PageHeader
        label="Overview"
        title={
          <>
            Your money, <span className="gradient-text">year by year</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary">Export</Button>
            <Button variant="primary" onClick={() => dispatch(openQuickAdd())}>
              + Quick Add
            </Button>
          </>
        }
      />

      {/* Year cards — click to open the year's detail */}
      <div className={styles.yearGrid}>
        {years.map((y, i) => (
          <motion.button
            key={y.year}
            className={styles.yearCard}
            onClick={() => navigate(`/year/${y.year}`)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.yearTop}>
              <span className={styles.year}>{y.year}</span>
              <span
                className={`${styles.rate} ${y.savingsRate >= 0 ? styles.ratePos : styles.rateNeg}`}
              >
                {(y.savingsRate * 100).toFixed(0)}% saved
              </span>
            </div>

            <Sparkline values={y.monthlyBalance} color="#0052ff" />

            <div className={styles.yearStats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Income</span>
                <span className={`${styles.statValue} ${styles.pos}`}>
                  ₹<CountUp value={y.income} format={formatAmount} />
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Spent</span>
                <span className={styles.statValue}>₹<CountUp value={y.expenditure} format={formatAmount} /></span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Invested</span>
                <span className={`${styles.statValue} ${styles.invest}`}>
                  ₹<CountUp value={y.investments} format={formatAmount} />
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Balance</span>
                <span className={`${styles.statValue} ${y.balance < 0 ? styles.neg : styles.accent}`}>
                  ₹<CountUp value={y.balance} format={formatAmount} />
                </span>
              </div>
            </div>

            <span className={styles.open}>View {y.year} →</span>
          </motion.button>
        ))}
      </div>

      {/* Cross-year comparison */}
      <Card className={styles.chartCard}>
        <h3 className={styles.chartTitle}>Income vs Spend vs Invest — by year</h3>
        <BarChart
          groups={years
            .slice()
            .reverse()
            .map((y) => ({ label: y.year, values: [y.income, y.expenditure, y.investments] }))}
          series={[
            { label: 'Income', color: '#0f9d58' },
            { label: 'Expenditure', color: '#0052ff' },
            { label: 'Investments', color: '#7c5cff' },
          ]}
        />
      </Card>
    </div>
  );
}
