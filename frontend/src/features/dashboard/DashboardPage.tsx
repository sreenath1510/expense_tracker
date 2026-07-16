import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, useGetMatrixQuery } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BarChart } from '@/components/charts/BarChart';
import { Sparkline } from '@/components/charts/Sparkline';
import { CountUp } from '@/components/ui/CountUp';
import { PeriodModeToggle } from '@/components/ui/PeriodModeToggle';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openQuickAdd } from '@/features/ui/uiSlice';
import { getPeriodSummaries } from '@/utils/yearly';
import { formatAmount } from '@/utils/format';
import styles from './DashboardPage.module.scss';

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const periodMode = useAppSelector((s) => s.ui.periodMode);
  const { data, isLoading, isError } = useGetMatrixQuery();

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const handleExport = async () => {
    setBusy('export');
    setMsg(null);
    try {
      const res = await fetch('/api/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fathom-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('Backup downloaded.');
    } catch {
      setMsg('Export failed — please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    setBusy('import');
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.detail ?? 'import failed');
      dispatch(api.util.resetApiState()); // refetch everything with the restored data
      const c = body.imported ?? {};
      setMsg(`Imported ${c.transactions ?? 0} transactions, ${c.income ?? 0} income, ${c.budgets ?? 0} budgets.`);
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.state}>
        <div className={styles.spinner} />
        <p>Loading your data…</p>
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

  const years = getPeriodSummaries(data, periodMode);

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
            <PeriodModeToggle />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
              {busy === 'import' ? 'Importing…' : 'Import'}
            </Button>
            <Button variant="secondary" onClick={handleExport} disabled={busy !== null}>
              {busy === 'export' ? 'Exporting…' : 'Export'}
            </Button>
            <Button variant="primary" onClick={() => dispatch(openQuickAdd())}>
              + Quick Add
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
          </>
        }
      />

      {msg && <p className={styles.backupMsg}>{msg}</p>}

      {/* Year cards — click to open the year's detail */}
      <div className={styles.yearGrid}>
        {years.map((y, i) => (
          <motion.button
            key={y.anchor}
            className={styles.yearCard}
            onClick={() => navigate(`/year/${y.anchor}`)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className={styles.yearTop}>
              <span className={styles.year}>{y.label}</span>
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

            <span className={styles.open}>View {y.label} →</span>
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
            .map((y) => ({ label: y.label, values: [y.income, y.expenditure, y.investments] }))}
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
