import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Trash2,
  Unlock,
} from 'lucide-react';
import {
  getCountryDisplayName,
  getScopeLabelLocalized,
  type Translations,
} from '../i18n/translations';
import type { SecurityVerifyErrorCode } from '../services/pingService';
import type {
  AppLanguage,
  CountryScope,
  ProtocolConfigTemplate,
  VpnProtocol,
} from '../types/vpn';
import {
  COUNTRY_META,
  parseEndpointFromConfig,
  PROTOCOL_META,
  VPN_COUNTRIES,
  VPN_PROTOCOLS,
} from '../utils/vpnParser';

interface SecurityBlockViewProps {
  isUnlocked: boolean;
  blockTemplates: ProtocolConfigTemplate[];
  language: AppLanguage;
  t: Translations;
  onBackToSettings: () => void;
  onVerifySecurityKey: (
    candidate: string
  ) => Promise<{ valid: boolean; errorCode?: SecurityVerifyErrorCode }>;
  onLockSection: () => void;
  onSaveTemplate: (template: ProtocolConfigTemplate) => Promise<void> | void;
  onDeleteTemplate: (id: string) => Promise<void> | void;
}

export function SecurityBlockView({
  isUnlocked,
  blockTemplates,
  language,
  t,
  onBackToSettings,
  onVerifySecurityKey,
  onLockSection,
  onSaveTemplate,
  onDeleteTemplate,
}: SecurityBlockViewProps) {
  // Access Gate State (always reset whenever locked or unmounted)
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [gateError, setGateError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Block Fix Editor State
  const [activeProtocol, setActiveProtocol] = useState<VpnProtocol>('VLESS');
  const [countryScope, setCountryScope] = useState<CountryScope>('ALL');
  const [rawConfig, setRawConfig] = useState('');
  const [note, setNote] = useState('');
  const [editorError, setEditorError] = useState('');
  const [editorSaved, setEditorSaved] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [listError, setListError] = useState('');

  useEffect(() => {
    if (!isUnlocked) {
      setKeyInput('');
      setShowKey(false);
      setGateError('');
      setConfirmDeleteId(null);
      setListError('');
    }
  }, [isUnlocked]);

  useEffect(() => {
    return () => {
      setKeyInput('');
      setGateError('');
    };
  }, []);

  useEffect(() => {
    const existing = blockTemplates.find(
      (item) =>
        item.protocol === activeProtocol && item.countryScope === countryScope
    );
    setRawConfig(existing?.rawConfig ?? '');
    setNote(existing?.note ?? '');
    setEditorError('');
  }, [activeProtocol, countryScope, blockTemplates]);

  useEffect(() => {
    setEditorSaved(false);
  }, [activeProtocol, countryScope]);

  const parsedEndpoint = useMemo(
    () => parseEndpointFromConfig(activeProtocol, rawConfig),
    [activeProtocol, rawConfig]
  );

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setGateError(t.securityBlock.errEnterKey);
      return;
    }

    setIsVerifying(true);
    setGateError('');
    const result = await onVerifySecurityKey(keyInput);
    setIsVerifying(false);

    if (!result.valid) {
      if (result.errorCode === 'SERVER_CONFIG_ERROR') {
        setGateError(t.securityBlock.errMissingEnvVars);
      } else if (result.errorCode === 'SERVER_ERROR') {
        setGateError(t.securityBlock.errServerUnavailable);
      } else if (result.errorCode === 'EMPTY') {
        setGateError(t.securityBlock.errEnterKey);
      } else {
        setGateError(t.securityBlock.errInvalidKey);
      }
      return;
    }

    setKeyInput('');
    setGateError('');
  };

  const handleSaveBlockConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingTemplate) return;
    const trimmedConfig = rawConfig.trim();
    if (!trimmedConfig) {
      setEditorError(t.securityBlock.errEmptyConfig);
      return;
    }
    const existing = blockTemplates.find(
      (item) =>
        item.protocol === activeProtocol && item.countryScope === countryScope
    );

    const template: ProtocolConfigTemplate = {
      id:
        existing?.id ??
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `tpl-${Date.now()}`),
      protocol: activeProtocol,
      countryScope,
      rawConfig: trimmedConfig,
      note: note.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    setIsSavingTemplate(true);
    setEditorError('');
    setEditorSaved(false);
    try {
      await onSaveTemplate(template);
      setEditorSaved(true);
      setTimeout(() => setEditorSaved(false), 2000);
    } catch (err) {
      setEditorSaved(false);
      setEditorError(
        err instanceof Error && err.message ? err.message : t.errors.saveFailed
      );
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleConfirmDeleteTemplate = async (id: string) => {
    if (deletingTemplateId) return;
    setDeletingTemplateId(id);
    setListError('');
    try {
      await onDeleteTemplate(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setListError(
        err instanceof Error && err.message ? err.message : t.errors.deleteFailed
      );
    } finally {
      setDeletingTemplateId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToSettings}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white min-h-[44px] px-2 -ml-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.securityBlock.backToSettings}</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{t.settings.breadcrumbSettings}</span>
          <span aria-hidden="true">→</span>
          <span>{t.settings.breadcrumbKey}</span>
          <span aria-hidden="true">→</span>
          <span className="text-violet-300 font-medium">
            {t.settings.breadcrumbBlockFix}
          </span>
        </div>
      </div>

      {/* Server-Verified Access Gate when locked */}
      {!isUnlocked ? (
        <section
          data-testid="security-key-gate"
          className="max-w-lg mx-auto rounded-2xl bg-[#0F091F] border border-violet-500/25 p-6 sm:p-7 space-y-5 shadow-xl shadow-black/30"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-violet-600/20 border border-violet-500/35 flex items-center justify-center text-violet-300 shrink-0">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white">
                {t.securityBlock.verifyTitle}
              </h1>
              <p className="text-sm text-slate-400">
                {t.securityBlock.verifyDesc}
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="verify-security-key"
                className="block text-sm font-medium text-slate-200"
              >
                {t.securityBlock.keyLabel}
              </label>
              <div className="relative">
                <input
                  id="verify-security-key"
                  type={showKey ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="off"
                  value={keyInput}
                  onChange={(e) => {
                    setKeyInput(e.target.value);
                    if (gateError) setGateError('');
                  }}
                  placeholder={t.securityBlock.keyPlaceholder}
                  autoFocus
                  className="w-full h-12 pl-4 pr-11 rounded-xl bg-[#07040F] border border-violet-500/30 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  aria-label={showKey ? t.securityBlock.hideKey : t.securityBlock.showKey}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-200"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {gateError && (
              <p role="alert" className="text-xs font-medium text-rose-400">
                {gateError}
              </p>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-65 text-white text-sm font-semibold shadow-md shadow-violet-950/60 transition-all flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{t.securityBlock.verifyingBtn}</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" aria-hidden="true" />
                  <span>{t.securityBlock.verifyAndEnter}</span>
                </>
              )}
            </button>

            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              {t.securityBlock.autoLockNote}
            </p>
          </form>
        </section>
      ) : (
        /* Unlocked: Исправление блока */
        <div className="space-y-6" data-testid="block-fix-editor">
          <section className="rounded-2xl bg-[#0F091F] border border-violet-500/20 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-violet-500/15">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  <span>{t.securityBlock.accessConfirmed}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                  {t.securityBlock.title}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  {t.securityBlock.desc}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={onLockSection}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-[#07040F] hover:bg-violet-950/60 border border-violet-500/30 text-violet-300 text-xs font-medium whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.securityBlock.lockBtn}</span>
                </button>
              </div>
            </div>

            {/* Protocol Tabs */}
            <div className="space-y-2">
              <span className="block text-xs font-medium text-slate-400">
                {t.securityBlock.protocolLabel}
              </span>
              <div
                role="tablist"
                aria-label={t.securityBlock.protocolTabsLabel}
                className="flex flex-wrap gap-2"
              >
                {VPN_PROTOCOLS.map((proto) => {
                  const isActive = activeProtocol === proto;
                  const countForProto = blockTemplates.filter(
                    (tpl) => tpl.protocol === proto
                  ).length;
                  return (
                    <button
                      key={proto}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveProtocol(proto)}
                      className={`px-3.5 py-2 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-2 ${
                        isActive
                          ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-950/60'
                          : 'bg-[#07040F] border border-violet-500/20 text-slate-300 hover:border-violet-400/45 hover:text-white'
                      }`}
                    >
                      <span>{proto}</span>
                      {countForProto > 0 && (
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isActive ? 'text-violet-100' : 'text-violet-300'
                          }`}
                        >
                          ({countForProto})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Configuration Form per Protocol (No separate host:port field) */}
            <form onSubmit={handleSaveBlockConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="block-country-scope"
                    className="block text-xs font-medium text-slate-300"
                  >
                    {t.securityBlock.countryScopeLabel}
                  </label>
                  <select
                    id="block-country-scope"
                    value={countryScope}
                    onChange={(e) => setCountryScope(e.target.value as CountryScope)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm text-slate-100 focus:outline-none focus:border-violet-400"
                  >
                    <option value="ALL">{t.securityBlock.allCountriesDefault}</option>
                    {VPN_COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {COUNTRY_META[country].flag} {getCountryDisplayName(country, language)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="block-note"
                    className="block text-xs font-medium text-slate-300"
                  >
                    {t.securityBlock.adminNoteLabel}
                  </label>
                  <input
                    id="block-note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t.securityBlock.adminNotePlaceholder}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="block-raw-config"
                  className="block text-sm font-medium text-slate-200"
                >
                  {t.securityBlock.configForProtocolLabel(activeProtocol)}
                </label>
                <textarea
                  id="block-raw-config"
                  rows={5}
                  value={rawConfig}
                  onChange={(e) => {
                    setRawConfig(e.target.value);
                    if (editorError) setEditorError('');
                  }}
                  placeholder={t.securityBlock.configPlaceholder(
                    PROTOCOL_META[activeProtocol].uriHint
                  )}
                  className="w-full p-3.5 rounded-xl bg-[#07040F] border border-violet-500/30 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    {parsedEndpoint ? (
                      <>
                        {t.securityBlock.parsedEndpointPrefix}{' '}
                        <strong className="font-mono text-violet-300">
                          {parsedEndpoint.host}:{parsedEndpoint.port}
                        </strong>
                      </>
                    ) : (
                      t.securityBlock.endpointNotParsed
                    )}
                  </span>
                </div>
              </div>

              {editorError && (
                <p role="alert" className="text-xs font-medium text-rose-400">
                  {editorError}
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-65 text-white text-sm font-semibold shadow-md shadow-violet-950/60 transition-all"
                >
                  {isSavingTemplate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>{t.result.savingRecordBtn}</span>
                    </>
                  ) : editorSaved ? (
                    <>
                      <Check className="w-4 h-4" aria-hidden="true" />
                      <span>{t.securityBlock.configSavedBtn}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" aria-hidden="true" />
                      <span>{t.securityBlock.saveConfigBtn}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* Saved Templates List */}
          <section className="rounded-2xl bg-[#0F091F] border border-violet-500/20 overflow-hidden">
            <div className="p-5 border-b border-violet-500/15 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white">
                {t.securityBlock.savedListTitle}
              </h2>
              <span className="text-xs text-slate-400 tabular-nums">
                {t.securityBlock.countUnit(blockTemplates.length)}
              </span>
            </div>

            {listError && (
              <div
                role="alert"
                className="px-5 py-3 bg-rose-950/35 border-b border-rose-500/35 text-xs font-medium text-rose-300"
              >
                {listError}
              </div>
            )}

            {blockTemplates.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                {t.securityBlock.savedListEmpty}
              </div>
            ) : (
              <ul className="divide-y divide-violet-500/15">
                {blockTemplates.map((tpl) => {
                  const isConfirming = confirmDeleteId === tpl.id;
                  const isDeleting = deletingTemplateId === tpl.id;
                  return (
                    <li
                      key={tpl.id}
                      data-testid={`template-item-${tpl.id}`}
                      className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="font-bold text-violet-300">{tpl.protocol}</span>
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span className="font-medium text-white">
                            {getScopeLabelLocalized(tpl.countryScope, language)}
                          </span>
                          {tpl.note && (
                            <>
                              <span aria-hidden="true" className="text-slate-500">·</span>
                              <span className="text-xs text-slate-400">{tpl.note}</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-400 truncate max-w-2xl">
                          {tpl.rawConfig}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProtocol(tpl.protocol);
                            setCountryScope(tpl.countryScope);
                          }}
                          className="px-3 py-2 min-h-[38px] rounded-lg bg-violet-950/70 hover:bg-violet-900/70 border border-violet-500/20 text-xs font-medium text-slate-100"
                        >
                          {t.securityBlock.editBtn}
                        </button>
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => void handleConfirmDeleteTemplate(tpl.id)}
                              className="px-3 py-2 min-h-[38px] rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap"
                            >
                              {isDeleting ? '...' : t.securityBlock.confirmDeleteBtn}
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-2 min-h-[38px] rounded-lg bg-violet-950/70 hover:bg-violet-900/70 text-slate-300 text-xs font-medium whitespace-nowrap"
                            >
                              {t.securityBlock.cancelDeleteBtn}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(tpl.id)}
                            aria-label={`${t.securityBlock.confirmDeleteBtn} ${tpl.protocol}`}
                            className="w-9 h-9 rounded-lg bg-[#07040F] hover:bg-rose-950/60 border border-violet-500/20 hover:border-rose-500/40 flex items-center justify-center text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
