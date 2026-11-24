import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, Shield, UserCheck } from 'lucide-react';
import { LANGUAGE_OPTIONS, type Translations } from '../i18n/translations';
import type { AppLanguage } from '../types/vpn';

interface AdminLoginViewProps {
  language: AppLanguage;
  t: Translations;
  onChangeLanguage: (lang: AppLanguage) => void;
  onLogin: (
    username: string,
    password: string
  ) => Promise<{
    authenticated: boolean;
    errorCode?: 'EMPTY' | 'INVALID_CREDENTIALS' | 'SERVER_ERROR' | 'SERVER_CONFIG_ERROR';
  }>;
}

export function AdminLoginView({
  language,
  t,
  onChangeLanguage,
  onLogin,
}: AdminLoginViewProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!password.trim()) {
      setError(t.auth.errEmptyPassword);
      return;
    }

    setIsSubmitting(true);
    setError('');
    const result = await onLogin(username, password);
    setIsSubmitting(false);

    if (!result.authenticated) {
      if (result.errorCode === 'EMPTY') {
        setError(t.auth.errEmptyPassword);
      } else if (result.errorCode === 'SERVER_CONFIG_ERROR') {
        setError(t.auth.errMissingEnvVars);
      } else if (result.errorCode === 'SERVER_ERROR') {
        setError(t.auth.errServerError);
      } else {
        setError(t.auth.errInvalidCredentials);
      }
      return;
    }

    setPassword('');
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 text-slate-100">
      <div className="w-full max-w-md space-y-6 animate-view-enter">
        {/* Language Selector Bar */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {LANGUAGE_OPTIONS.map((option) => {
            const active = language === option.code;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => onChangeLanguage(option.code)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-violet-600/25 border-violet-400 text-white'
                    : 'bg-[#0F091F] border-violet-500/20 text-slate-300 hover:border-violet-400/45'
                }`}
              >
                {option.flag} {option.label}
              </button>
            );
          })}
        </div>

        {/* Login Card */}
        <section className="rounded-2xl bg-[#0F091F] border border-violet-500/25 p-6 sm:p-7 space-y-6 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 shadow-lg shadow-violet-950/70 flex items-center justify-center text-white shrink-0">
              <Shield className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                VEXTON VPN
              </p>
              <h1 className="text-xl font-extrabold text-white">
                {t.auth.loginTitle}
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-400 leading-relaxed">
            {t.auth.loginSubtitle}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-login-username"
                className="block text-xs font-medium text-slate-300"
              >
                {t.auth.usernameLabel}
              </label>
              <input
                id="admin-login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError('');
                }}
                placeholder={t.auth.usernamePlaceholder}
                className="w-full h-11 px-4 rounded-xl bg-[#07040F] border border-violet-500/25 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="admin-login-password"
                className="block text-xs font-medium text-slate-300"
              >
                {t.auth.passwordLabel}
              </label>
              <div className="relative">
                <input
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder={t.auth.passwordPlaceholder}
                  autoFocus
                  className="w-full h-11 pl-4 pr-11 rounded-xl bg-[#07040F] border border-violet-500/25 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? t.auth.hidePassword : t.auth.showPassword
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs font-medium text-rose-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-65 text-white text-sm font-semibold shadow-lg shadow-violet-950/60 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{t.auth.loggingInBtn}</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{t.auth.loginBtn}</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-violet-500/15 flex items-start gap-2 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{t.auth.securityNote}</span>
          </div>
        </section>
      </div>
    </div>
  );
}
