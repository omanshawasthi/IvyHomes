import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi, ApiError } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import './LoginPage.css';

export function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const { setUser } = useAuthStore();

  const login = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => setUser(data.user),
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Invalid credentials' : err.message);
      } else {
        setError('Could not connect to server');
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate({ email, password });
  };

  return (
    <div className="login-layout">
      <div className="login-hero">
        <div className="login-hero__content">
          <div className="login-hero__overline">Bangalore · Bellandur</div>
          <h1 className="login-hero__title">Ivy Homes</h1>
          <p className="login-hero__sub">
            Property intelligence platform.<br />
            Browse listings, rentals, and projects.
          </p>
        </div>
        {/* Blueprint grid overlay */}
        <div className="login-hero__grid" aria-hidden="true" />
      </div>

      <div className="login-form-pane">
        <form
          id="login-form"
          className="login-form"
          onSubmit={handleSubmit}
          aria-label="Sign in"
        >
          <header className="login-form__header">
            <h2 className="login-form__title">Sign in</h2>
          </header>

          <div className="login-form__field">
            <label htmlFor="input-email" className="login-form__label">Email</label>
            <input
              id="input-email"
              type="email"
              className="login-form__input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={login.isPending}
            />
          </div>

          <div className="login-form__field">
            <label htmlFor="input-password" className="login-form__label">Password</label>
            <input
              id="input-password"
              type="password"
              className="login-form__input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={login.isPending}
            />
          </div>

          {error && (
            <p className="login-form__error" role="alert" id="login-error">
              {error}
            </p>
          )}

          <button
            id="btn-login"
            type="submit"
            className="login-form__submit"
            disabled={login.isPending}
          >
            {login.isPending ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
      </div>
    </div>
  );
}
