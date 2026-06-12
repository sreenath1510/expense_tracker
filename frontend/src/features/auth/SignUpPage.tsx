import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useRegisterMutation } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials } from './authSlice';
import styles from './LoginPage.module.scss';

export function SignUpPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const [register, { isLoading }] = useRegisterMutation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (token) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = username.trim();
    if (name.length < 3) return setError('Username must be at least 3 characters.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    try {
      const result = await register({ username: name, password }).unwrap();
      dispatch(setCredentials(result));
      navigate('/', { replace: true });
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 409
          ? 'That username is taken — try another.'
          : 'Could not create your account. Is the backend running?',
      );
    }
  };

  return (
    <div className={styles.screen}>
      <motion.div
        className={styles.wrap}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className={styles.brand}>
          <Logo size={44} className={styles.brandMark} />
          <span className={styles.brandName}>Ledger</span>
        </div>

        <Card className={styles.card}>
          <h1 className={styles.title}>
            Create your <span className="gradient-text">ledger</span>
          </h1>
          <p className={styles.subtitle}>A fresh, private space for your money.</p>

          <form className={styles.form} onSubmit={handleSubmit}>
            <Input
              label="Username"
              name="username"
              autoComplete="username"
              value={username}
              autoFocus
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Confirm password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            {error && <span className={styles.error}>{error}</span>}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading || !username.trim() || !password || !confirm}
            >
              {isLoading ? 'Creating…' : 'Create account'}
            </Button>
          </form>

          <p className={styles.switch}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </Card>

        <p className={styles.hint}>Local &amp; private — your data never leaves your machine.</p>
      </motion.div>
    </div>
  );
}
