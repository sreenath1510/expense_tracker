import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Logo } from '@/components/ui/Logo';
import { useLoginMutation } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCredentials } from './authSlice';
import styles from './LoginPage.module.scss';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAppSelector((s) => s.auth.token);
  const [login, { isLoading }] = useLoginMutation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Don't show the form — bounce to where they came from.
  const redirectTo = (location.state as LocationState | null)?.from ?? '/';
  if (token) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await login({ username: username.trim(), password }).unwrap();
      dispatch(setCredentials(result));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 401
          ? 'Incorrect username or password.'
          : 'Could not reach the server. Is the backend running?',
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
          <span className={styles.brandName}>Fathom</span>
        </div>

        <Card className={styles.card}>
          <h1 className={styles.title}>
            Welcome <span className="gradient-text">back</span>
          </h1>
          <p className={styles.subtitle}>Sign in to your private Fathom.</p>

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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <span className={styles.error}>{error}</span>}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading || !username.trim() || !password}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className={styles.switch}>
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </Card>

        <p className={styles.hint}>Local &amp; private — your data never leaves your machine.</p>
      </motion.div>
    </div>
  );
}
