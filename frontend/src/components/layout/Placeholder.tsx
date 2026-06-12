import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import styles from './Placeholder.module.scss';

interface PlaceholderProps {
  label: string;
  title: string;
  description: string;
  next: string;
}

/**
 * Temporary placeholder so all routes resolve while we build features
 * module by module. Each will be replaced by its real feature component.
 */
export function Placeholder({ label, title, description, next }: PlaceholderProps) {
  return (
    <div>
      <PageHeader label={label} title={title} description={description} />
      <Card className={styles.card}>
        <span className={styles.badge}>Coming next</span>
        <p className={styles.text}>{next}</p>
      </Card>
    </div>
  );
}
