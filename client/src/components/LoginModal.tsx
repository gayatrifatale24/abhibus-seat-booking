import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('demo@abhibus.test');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={onClose}>
      <form className="modal__card" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <h2 id="login-title">{mode === 'login' ? 'Log in to book' : 'Create account'}</h2>
        {mode === 'login' && <p className="muted small">Demo account is pre-filled: demo@abhibus.test / demo1234</p>}
        {mode === 'register' && (
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
        )}
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} /></label>
        {error && <p className="alert" role="alert">{error}</p>}
        <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="link small" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
        </button>
      </form>
    </div>
  );
}
