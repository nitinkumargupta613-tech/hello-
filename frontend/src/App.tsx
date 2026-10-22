import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { api } from "./api";
import { clearSession, loadSession, saveSession, token, type Session } from "./auth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Submit from "./pages/Submit";
import TicketStatus from "./pages/TicketStatus";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-3.5 py-2 text-sm font-medium transition-[background-color,color] duration-150 ${
    isActive
      ? "bg-brand-50 text-brand-800 shadow-[inset_0_0_0_1px_var(--color-brand-100)]"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

function AdminOnly({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(loadSession);
  const [checking, setChecking] = useState(Boolean(token()));

  useEffect(() => {
    // Without a stored token there is nothing to check - go straight to login.
    if (!token()) {
      setChecking(false);
      return;
    }
    let active = true;
    api
      .me()
      .then((current) => {
        if (!active) return;
        saveSession(current);
        setSession(current);
      })
      .catch(() => {
        if (!active) return;
        clearSession();
        setSession(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p className="animate-pulse text-sm text-slate-500">Checking your session…</p>
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (session.role !== "admin") {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Admins Only</h1>
        <p className="mt-2 text-sm text-slate-600">
          You are signed in as <span className="font-mono">{session.username}</span>. The
          operations dashboard needs an admin account.
        </p>
      </div>
    );
  }
  return children;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  // Move focus to the main region on navigation so screen reader and keyboard
  // users start at the new content instead of the top of the nav.
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  async function signOut() {
    try {
      await api.logout();
    } catch {
      /* the token is gone either way */
    }
    clearSession();
    setSession(null);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-sm"
              aria-hidden="true"
            >
              C
            </div>
            <div>
              <p className="text-base font-semibold leading-tight text-slate-900">
                CivicSense
              </p>
              <p className="text-xs text-slate-500">
                Civic intelligence &amp; issue resolution
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink to="/" end className={navLink}>
              Report an Issue
            </NavLink>
            <NavLink to="/ticket" className={navLink}>
              Track a Ticket
            </NavLink>
            <NavLink to="/dashboard" className={navLink}>
              Operations
            </NavLink>
            {session ? (
              <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3">
                <span className="hidden text-xs text-slate-500 sm:inline">
                  {session.display_name}
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="btn btn-ghost !px-2.5 !py-1.5 text-sm"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </nav>
        </div>
      </header>

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 focus:outline-none"
      >
        <Routes>
          <Route path="/" element={<Submit />} />
          <Route path="/ticket" element={<TicketStatus />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <AdminOnly>
                <Dashboard />
              </AdminOnly>
            }
          />
        </Routes>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-slate-500">
          <p>CivicSense · AI assisted civic issue triage</p>
          <p>
            Categories: Pothole · Garbage · Water leak · Streetlight · Drainage · Other
          </p>
        </div>
      </footer>
    </div>
  );
}
