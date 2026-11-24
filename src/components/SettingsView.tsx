import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  KeyRound,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Save,
  ServerCog,
  Trash2,
  Unlock,
} from 'lucide-react';
import { LANGUAGE_OPTIONS, type Translations } from '../i18n/translations';
import type {
  AppLanguage,
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  VpnCodeRecord,
} from '../types/vpn';
import { exportWorkspaceJson } from '../utils/storage';

interface SettingsViewProps {
  architecture: ServerArchitectureConfig;
  codes: VpnCodeRecord[];
  blockTemplates: ProtocolConfigTemplate[];
  codesCount: number;
  isSecurityUnlocked: boolean;
  language: AppLanguage;
  t: Translations;
  onChangeLanguage: (lang: AppLanguage) => void;
  onBackToDashboard: () => void;
  onOpenSecurityBlock: () => void;
  onSaveArchitecture: (next: ServerArchitectureConfig) => Promise<void> | void;
  onClearCodes: () => Promise<void> | void;
  onLogout: () => void;
}

export function SettingsView({
  architecture,
  codes,
  blockTemplates,
  codesCount,
  isSecurityUnlocked,
  language,
  t,
  onChangeLanguage,
  onBackToDashboard,
  onOpenSecurityBlock,
  onSaveArchitecture,
  onClearCodes,
  onLogout,
}: SettingsViewProps) {
  const [draft, setDraft] = useState<ServerArchitectureConfig>(architecture);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSavingArch, setIsSavingArch] = useState(false);
  const [langSavedNotice, setLangSavedNotice] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    setDraft(architecture);
  }, [architecture]);

  const handleSaveArch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingArch) return;
    setIsSavingArch(true);
    setSaveError('');
    setSavedNotice(false);
    try {
      await onSaveArchitecture(draft);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch (err) {
      setSaveError(
        err instanceof Error && err.message ? err.message : t.errors.saveFailed
      );
    } finally {
      setIsSavingArch(false);
    }
  };

  const handleSelectLanguage = (nextLang: AppLanguage) => {
    onChangeLanguage(nextLang);
    setLangSavedNotice(true);
    setTimeout(() => setLangSavedNotice(false), 2000);
  };

  const handleExportJson = () => {
    const json = exportWorkspaceJson({
      codes,
      blockTemplates,
      architecture,
    });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vexton-vpn-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white min-h-[44px] px-2 -ml-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.settings.backToHome}</span>
        </button>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-white">{t.settings.title}</h1>
        <p className="text-sm text-slate-400">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Language Switcher Section */}
      <section className="rounded-2xl bg-[#0F091F] border border-violet-500/25 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-start gap-3">
            <Languages className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">{t.settings.languageTitle}</h2>
              <p className="text-xs sm:text-sm text-slate-400">
                {t.settings.languageDesc}
              </p>
            </div>
          </div>
          {langSavedNotice && (
            <span
              role="status"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 shrink-0"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.settings.languageSaved}</span>
            </span>
          )}
        </div>

        <div
          role="radiogroup"
          aria-label={t.settings.languageTitle}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {LANGUAGE_OPTIONS.map((option) => {
            const active = language === option.code;
            return (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleSelectLanguage(option.code)}
                className={`flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] rounded-xl border text-sm font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-violet-600/25 border-violet-400 text-white shadow-sm shadow-violet-950/60'
                    : 'bg-[#07040F] border-violet-500/20 hover:border-violet-400/45 text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <span className="text-base">{option.flag}</span>
                  <span>{option.label}</span>
                </span>
                {active && <Check className="w-4 h-4 text-violet-300 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Entry to Protected Section: Настройки -> Защитный ключ -> Исправление блока */}
      <section className="rounded-2xl bg-[#0F091F] border border-violet-500/35 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-violet-300 flex-wrap">
              <span>{t.settings.breadcrumbSettings}</span>
              <span aria-hidden="true">→</span>
              <span>{t.settings.breadcrumbKey}</span>
              <span aria-hidden="true">→</span>
              <span>{t.settings.breadcrumbBlockFix}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-5 h-5 text-violet-400 shrink-0" aria-hidden="true" />
              <h2 className="text-lg font-bold text-white">
                {t.settings.securitySectionTitle}
              </h2>
            </div>
            <p className="text-sm text-slate-400">
              {t.settings.securitySectionDesc}
            </p>
            <p className="text-xs text-slate-300 tabular-nums pt-1">
              {t.settings.savedConfigsMeta(blockTemplates.length)} · {t.settings.statusLabel}{' '}
              <span className={isSecurityUnlocked ? 'text-emerald-400' : 'text-violet-300'}>
                {isSecurityUnlocked
                  ? t.settings.statusUnlocked
                  : t.settings.statusNeedCheck}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenSecurityBlock}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold shadow-md shadow-violet-950/50 transition-all whitespace-nowrap shrink-0"
          >
            {isSecurityUnlocked ? (
              <Unlock className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Lock className="w-4 h-4" aria-hidden="true" />
            )}
            <span>{t.settings.openSecurityKeyBtn}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Architecture Readiness for Connecting Real VPN Servers */}
      <form
        onSubmit={handleSaveArch}
        className="rounded-2xl bg-[#0F091F] border border-violet-500/20 p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-start gap-3">
          <ServerCog className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">
              {t.settings.archTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              {t.settings.archDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="adapter-mode-select"
              className="block text-xs font-medium text-slate-300"
            >
              {t.settings.adapterModeLabel}
            </label>
            <select
              id="adapter-mode-select"
              value={draft.adapterMode}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  adapterMode: e.target.value as ServerArchitectureConfig['adapterMode'],
                }))
              }
              className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm text-slate-100 focus:outline-none focus:border-violet-400"
            >
              <option value="local_only">{t.settings.adapterModeLocal}</option>
              <option value="rest_api_ready">{t.settings.adapterModeRest}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="auth-header-input"
              className="block text-xs font-medium text-slate-300"
            >
              {t.settings.authHeaderLabel}
            </label>
            <input
              id="auth-header-input"
              type="text"
              value={draft.authHeaderName}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, authHeaderName: e.target.value }))
              }
              placeholder="Authorization"
              className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm font-mono text-slate-100 focus:outline-none focus:border-violet-400"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="api-base-url-input"
              className="block text-xs font-medium text-slate-300"
            >
              {t.settings.apiBaseUrlLabel}
            </label>
            <input
              id="api-base-url-input"
              type="url"
              value={draft.apiBaseUrl}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, apiBaseUrl: e.target.value }))
              }
              placeholder="https://api.your-vpn-node.example"
              className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-400"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="sync-endpoint-input"
              className="block text-xs font-medium text-slate-300"
            >
              {t.settings.syncPathLabel}
            </label>
            <input
              id="sync-endpoint-input"
              type="text"
              value={draft.syncEndpointPath}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, syncEndpointPath: e.target.value }))
              }
              placeholder="/api/workspace"
              className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm font-mono text-slate-100 focus:outline-none focus:border-violet-400"
            />
          </div>
        </div>

        <div className="rounded-xl bg-[#07040F] border border-violet-500/20 p-3.5 flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-semibold text-white">
              {t.settings.base64ToggleTitle}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t.settings.base64ToggleDesc}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(draft.convertVlessToBase64)}
            aria-label={t.settings.base64ToggleTitle}
            data-testid="settings-base64-toggle-switch"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                convertVlessToBase64: !prev.convertVlessToBase64,
              }))
            }
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              draft.convertVlessToBase64
                ? 'bg-gradient-to-r from-violet-500 to-purple-500 border-violet-300/60 shadow-inner shadow-violet-950/40'
                : 'bg-[#140D2A] border-violet-500/35'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                draft.convertVlessToBase64 ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={draft.autoPingOnCreate}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, autoPingOnCreate: e.target.checked }))
            }
            className="w-4 h-4 rounded border-violet-500/40 bg-[#07040F] text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-slate-200">
            {t.settings.autoPingCheckbox}
          </span>
        </label>

        {saveError && (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {saveError}
          </p>
        )}

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSavingArch}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-65 text-white text-sm font-semibold shadow-md shadow-violet-950/50 transition-all"
          >
            {isSavingArch ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>{t.result.savingRecordBtn}</span>
              </>
            ) : savedNotice ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>{t.settings.savedBtn}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{t.settings.saveSettingsBtn}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Shared Server Database & Session Controls */}
      <section className="rounded-2xl bg-[#0F091F] border border-violet-500/20 p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-white">{t.settings.localStorageTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            {t.settings.localStorageDesc}
          </p>
        </div>

        {clearError && (
          <p role="alert" className="text-xs font-medium text-rose-400">
            {clearError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-violet-950/70 hover:bg-violet-900/70 border border-violet-500/25 text-slate-100 text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4 text-violet-300" aria-hidden="true" />
            <span>{t.settings.exportJsonBtn}</span>
          </button>

          {codesCount > 0 && (
            confirmClear ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={async () => {
                    setIsClearing(true);
                    setClearError('');
                    try {
                      await onClearCodes();
                      setConfirmClear(false);
                    } catch (err) {
                      setClearError(
                        err instanceof Error && err.message
                          ? err.message
                          : t.errors.deleteFailed
                      );
                    } finally {
                      setIsClearing(false);
                    }
                  }}
                  className="px-4 py-2.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-sm font-semibold"
                >
                  {isClearing ? '...' : t.settings.confirmClearBtn(codesCount)}
                </button>
                <button
                  type="button"
                  disabled={isClearing}
                  onClick={() => setConfirmClear(false)}
                  className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-violet-950/70 hover:bg-violet-900/70 disabled:opacity-60 text-slate-300 text-sm font-medium"
                >
                  {t.settings.cancelBtn}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#07040F] hover:bg-rose-950/50 border border-violet-500/20 hover:border-rose-500/40 text-slate-300 hover:text-rose-300 text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>{t.settings.clearAllCodesBtn}</span>
              </button>
            )
          )}

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#07040F] hover:bg-violet-950/60 border border-violet-500/25 text-violet-200 text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4 text-violet-300" aria-hidden="true" />
            <span>{t.settings.logoutAdminBtn}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
