import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api";
import { clearSession, saveSession } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session = await api.login(username.trim(), password);
      saveSession(session);
      navigate(from, { replace: true });
    } catch (err) {
      clearSession();
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-7 py-8 text-white">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur"
            aria-hidden="true"
          >
            C
          </div>
          <h1 className="mt-4 text-xl font-semibold">Admin Sign In</h1>
          <p className="mt-1 text-sm text-white/75">
            The operations dashboard is only available to civic admins.
          </p>
        </div>

        <form className="space-y-4 px-7 py-7" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Username
            </span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              name="username"
              spellCheck={false}
              required
              className="field"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </span>
            <span className="relative block">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                name="password"
                required
                className="field pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>

          <p aria-live="polite" className="min-h-0">
            {error ? (
              <span className="block rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                {error}
              </span>
            ) : null}
          </p>

          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="border-t border-slate-200/80 bg-slate-50/70 px-7 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Demo Accounts
          </p>
          <dl className="mt-2 space-y-1 text-sm text-slate-600">
            <div className="flex justify-between gap-4">
              <dt>Admin</dt>
              <dd className="font-mono text-xs text-slate-700">
                admin / 1234
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Reporter</dt>
              <dd className="font-mono text-xs text-slate-700">
                reporter / 1234
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
