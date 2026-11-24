import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { getCountryDisplayName, type Translations } from '../i18n/translations';
import { vextonServerAdapter } from '../services/pingService';
import type {
  AppLanguage,
  PingResult,
  ProtocolConfigTemplate,
  TimeUnit,
  VpnCodeRecord,
  VpnCountry,
} from '../types/vpn';
import { copyToClipboard } from '../utils/storage';
import {
  applyVlessBase64Setting,
  calculateRemainingSeconds,
  COUNTRY_META,
  formatDurationLabel,
  formatRemainingCountdown,
  formatVpnConfigLink,
  getSafeCountryMeta,
  isBase64EncodedVless,
  parseEndpointFromConfig,
  resolveProtocolConfig,
  VPN_COUNTRIES,
} from '../utils/vpnParser';

interface CodeResultViewProps {
  record: VpnCodeRecord;
  blockTemplates: ProtocolConfigTemplate[];
  convertVlessToBase64?: boolean;
  autoPingOnOpen?: boolean;
  initialEditing?: boolean;
  language: AppLanguage;
  t: Translations;
  onUpdateRecord: (updated: VpnCodeRecord) => Promise<void> | void;
  onNotifyCopied: (recordName?: string) => void;
  onExitToDashboard: () => void;
  onOpenSecurityBlock: () => void;
}

export function CodeResultView({
  record,
  blockTemplates,
  convertVlessToBase64 = false,
  autoPingOnOpen = false,
  initialEditing = false,
  language,
  t,
  onUpdateRecord,
  onNotifyCopied,
  onExitToDashboard,
  onOpenSecurityBlock,
}: CodeResultViewProps) {
  const [copied, setCopied] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  // Edit record state
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [draftName, setDraftName] = useState(record.name);
  const [draftCountry, setDraftCountry] = useState<VpnCountry>(
    getSafeCountryMeta(record.country).country
  );
  const [draftDurationAmount, setDraftDurationAmount] = useState(record.durationAmount);
  const [draftDurationUnit, setDraftDurationUnit] = useState<TimeUnit>(record.durationUnit);
  const [draftConfig, setDraftConfig] = useState(record.rawConfig);
  const [editError, setEditError] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setIsEditing(initialEditing);
  }, [record.id, initialEditing]);

  useEffect(() => {
    if (!isEditing) {
      setDraftName(record.name);
      setDraftCountry(getSafeCountryMeta(record.country).country);
      setDraftDurationAmount(record.durationAmount);
      setDraftDurationUnit(record.durationUnit);
      setDraftConfig(record.rawConfig);
      setEditError('');
    }
  }, [record, isEditing]);

  const safeCountry = getSafeCountryMeta(record.country);

  const matchedTemplate = useMemo(
    () => resolveProtocolConfig(blockTemplates, record.protocol, safeCountry.country),
    [blockTemplates, record.protocol, safeCountry.country]
  );

  const hasConfig = record.rawConfig.trim().length > 0;
  const isBase64Vless =
    record.protocol === 'VLESS' && isBase64EncodedVless(record.rawConfig);
  const countdown = formatRemainingCountdown(record.expiresAt, Date.now(), language);
  const durationText = formatDurationLabel(
    record.durationAmount,
    record.durationUnit,
    language
  );
  const parsedEndpoint = parseEndpointFromConfig(record.protocol, record.rawConfig);
  const localeCode =
    language === 'en' ? 'en-US' : language === 'tk' ? 'tk-TM' : 'ru-RU';

  const runRealPing = async (targetRecord: VpnCodeRecord) => {
    setIsPinging(true);
    setActionError('');
    try {
      const result: PingResult = await vextonServerAdapter.probeEndpoint({
        protocol: targetRecord.protocol,
        rawConfig: targetRecord.rawConfig,
      });
      await onUpdateRecord({
        ...targetRecord,
        lastPing: result,
      });
    } catch (err) {
      setActionError(
        err instanceof Error && err.message ? err.message : t.errors.saveFailed
      );
    } finally {
      setIsPinging(false);
    }
  };

  useEffect(() => {
    if (
      autoPingOnOpen &&
      !record.lastPing &&
      parsedEndpoint !== null
    ) {
      void runRealPing(record);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, autoPingOnOpen]);

  const handleCopy = async () => {
    if (!hasConfig) return;
    const ok = await copyToClipboard(record.rawConfig);
    if (ok) {
      setCopied(true);
      onNotifyCopied(record.name);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyAndExit = async () => {
    if (hasConfig) {
      const ok = await copyToClipboard(record.rawConfig);
      if (ok) {
        onNotifyCopied(record.name);
      }
    }
    onExitToDashboard();
  };

  const handleSyncFromBlock = async () => {
    if (!matchedTemplate) return;
    setActionError('');
    const formatted = formatVpnConfigLink({
      protocol: record.protocol,
      rawConfig: matchedTemplate.rawConfig,
      country: safeCountry.country,
      name: record.name,
    });
    const finalConfig = applyVlessBase64Setting({
      protocol: record.protocol,
      formattedConfig: formatted,
      convertToBase64: Boolean(convertVlessToBase64),
    });
    try {
      await onUpdateRecord({
        ...record,
        rawConfig: finalConfig,
        configSource: 'block_fix',
        lastPing: undefined,
      });
    } catch (err) {
      setActionError(
        err instanceof Error && err.message ? err.message : t.errors.saveFailed
      );
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      setEditError(t.result.editNameError);
      return;
    }

    const safeAmount = Math.max(1, Math.floor(Number(draftDurationAmount) || 1));
    const seconds = calculateRemainingSeconds(safeAmount, draftDurationUnit);
    const expiresAt = new Date(Date.now() + seconds * 1000).toISOString();
    const trimmedConfig = draftConfig.trim();
    const formattedConfig = trimmedConfig
      ? formatVpnConfigLink({
          protocol: record.protocol,
          rawConfig: trimmedConfig,
          country: draftCountry,
          name: trimmedName,
        })
      : '';
    const finalConfig = formattedConfig
      ? applyVlessBase64Setting({
          protocol: record.protocol,
          formattedConfig,
          convertToBase64: Boolean(convertVlessToBase64),
        })
      : '';
    const configChanged = finalConfig !== record.rawConfig.trim();

    setIsSavingEdit(true);
    setEditError('');
    setActionError('');
    try {
      await onUpdateRecord({
        ...record,
        name: trimmedName,
        country: draftCountry,
        durationAmount: safeAmount,
        durationUnit: draftDurationUnit,
        durationLabel: formatDurationLabel(safeAmount, draftDurationUnit, language),
        expiresAt,
        rawConfig: finalConfig,
        configSource:
          finalConfig.length > 0
            ? trimmedConfig !== record.rawConfig.trim()
              ? 'manual'
              : record.configSource === 'pending'
                ? 'block_fix'
                : record.configSource
            : 'pending',
        lastPing: configChanged ? undefined : record.lastPing,
        updatedAt: new Date().toISOString(),
      });
      setIsEditing(false);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2600);
    } catch (err) {
      setEditError(
        err instanceof Error && err.message ? err.message : t.errors.saveFailed
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const pingErrorText = record.lastPing
    ? record.lastPing.errorCode
      ? t.pingErrors[record.lastPing.errorCode]
      : record.lastPing.error || t.result.serverUnreachable
    : '';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Back Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={onExitToDashboard}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white min-h-[44px] px-2 -ml-2 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t.result.backToHome}</span>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 tabular-nums">
            {t.result.createdAt(new Date(record.createdAt).toLocaleString(localeCode))}
          </span>
          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setDraftName(record.name);
                setDraftCountry(safeCountry.country);
                setDraftDurationAmount(record.durationAmount);
                setDraftDurationUnit(record.durationUnit);
                setDraftConfig(record.rawConfig);
                setEditError('');
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-violet-950/70 hover:bg-violet-900/70 border border-violet-500/30 text-xs font-semibold text-violet-200 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.result.editRecordBtn}</span>
            </button>
          )}
        </div>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="rounded-xl bg-emerald-500/15 border border-emerald-400/35 px-4 py-3 flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald-300"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t.result.savedRecordNotice}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-xl bg-rose-950/40 border border-rose-500/40 px-4 py-3 flex items-center gap-2 text-xs sm:text-sm font-medium text-rose-300"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Edit Record Form */}
      {isEditing && (
        <form
          onSubmit={handleSaveEdit}
          data-testid="edit-record-form"
          className="rounded-2xl bg-[#0F091F] border border-violet-400/40 p-5 sm:p-6 space-y-5 shadow-xl shadow-violet-950/50 animate-step-enter"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-violet-500/15">
            <h2 className="text-lg font-bold text-white">{t.result.editTitle}</h2>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              aria-label={t.result.cancelEditBtn}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-violet-900/40 flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-record-name"
                className="block text-xs font-medium text-slate-300"
              >
                {t.result.editNameLabel}
              </label>
              <input
                id="edit-record-name"
                type="text"
                value={draftName}
                onChange={(e) => {
                  setDraftName(e.target.value);
                  if (editError) setEditError('');
                }}
                placeholder={t.result.editNamePlaceholder}
                className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/30 text-sm text-white focus:outline-none focus:border-violet-400"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-record-country"
                className="block text-xs font-medium text-slate-300"
              >
                {t.result.editCountryLabel}
              </label>
              <select
                id="edit-record-country"
                value={draftCountry}
                onChange={(e) => setDraftCountry(e.target.value as VpnCountry)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/30 text-sm text-white focus:outline-none focus:border-violet-400"
              >
                {VPN_COUNTRIES.map((countryOption) => (
                  <option key={countryOption} value={countryOption}>
                    {COUNTRY_META[countryOption].flag}{' '}
                    {getCountryDisplayName(countryOption, language)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-record-amount"
                className="block text-xs font-medium text-slate-300"
              >
                {t.result.editDurationAmountLabel}
              </label>
              <input
                id="edit-record-amount"
                type="number"
                min={1}
                max={3650}
                value={draftDurationAmount}
                onChange={(e) => setDraftDurationAmount(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/30 text-sm text-white font-mono tabular-nums focus:outline-none focus:border-violet-400"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="edit-record-unit"
                className="block text-xs font-medium text-slate-300"
              >
                {t.result.editDurationUnitLabel}
              </label>
              <select
                id="edit-record-unit"
                value={draftDurationUnit}
                onChange={(e) => setDraftDurationUnit(e.target.value as TimeUnit)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/30 text-sm text-white focus:outline-none focus:border-violet-400"
              >
                <option value="minutes">{t.wizard.unitMinutes}</option>
                <option value="hours">{t.wizard.unitHours}</option>
                <option value="days">{t.wizard.unitDays}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="edit-record-config"
              className="block text-xs font-medium text-slate-300"
            >
              {t.result.editConfigLabel}
            </label>
            <textarea
              id="edit-record-config"
              rows={4}
              value={draftConfig}
              onChange={(e) => setDraftConfig(e.target.value)}
              placeholder={t.result.editConfigPlaceholder}
              className="w-full p-3.5 rounded-xl bg-[#07040F] border border-violet-500/30 text-xs sm:text-sm font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
            />
          </div>

          {editError && (
            <p role="alert" className="text-xs font-medium text-rose-400">
              {editError}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2.5 min-h-[42px] rounded-xl bg-violet-950/60 hover:bg-violet-900/60 border border-violet-500/20 text-xs sm:text-sm font-medium text-slate-200"
            >
              {t.result.cancelEditBtn}
            </button>
            <button
              type="submit"
              disabled={isSavingEdit}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[42px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-65 text-white text-xs sm:text-sm font-semibold shadow-md shadow-violet-950/60"
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{t.result.savingRecordBtn}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>{t.result.saveRecordBtn}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Main Result Card */}
      <section className="rounded-2xl bg-[#0F091F] border border-violet-500/20 p-5 sm:p-6 space-y-6 shadow-xl shadow-black/30">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-white break-words flex items-center gap-2.5 flex-wrap">
            <span>{safeCountry.flag}</span>
            <span className="text-violet-200 font-bold">
              {getCountryDisplayName(safeCountry.country, language)}
            </span>
            <span className="text-violet-500/70" aria-hidden="true">
              ·
            </span>
            <span>{record.name}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-300 tabular-nums">
            <span className="font-semibold text-violet-300">{record.protocol}</span>
            <span aria-hidden="true">·</span>
            <span className={countdown.expired ? 'text-rose-400' : 'text-slate-200'}>
              {countdown.label} ({durationText})
            </span>
          </div>
        </div>

        {/* Real Server Configuration Display */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              {t.result.realServerConfigTitle}
            </h2>
            {hasConfig && (
              <div className="flex flex-wrap items-center gap-2.5">
                {isBase64Vless && (
                  <span
                    data-testid="result-base64-badge"
                    className="text-xs font-mono font-semibold text-emerald-300"
                  >
                    {t.result.sourceBase64Badge}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>{t.result.sourceBlockFix}</span>
                </span>
              </div>
            )}
          </div>

          {hasConfig ? (
            <div
              data-testid="vpn-config-ready-card"
              className="rounded-xl bg-violet-950/35 border border-violet-500/35 p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>{t.result.configReadyTitle}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t.result.configReadyDesc}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-950/20 border border-amber-500/30 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-sm text-amber-200 space-y-1">
                  <p className="font-semibold text-amber-300">
                    {t.result.noConfigTitle}
                  </p>
                  <p className="text-xs text-amber-200/80">
                    {t.result.noConfigDesc}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {matchedTemplate && (
                  <button
                    type="button"
                    onClick={() => void handleSyncFromBlock()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-xs font-semibold text-white shadow-md shadow-violet-950/50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t.result.syncFromBlockBtn}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenSecurityBlock}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-950/80 hover:bg-violet-900/80 border border-violet-500/25 text-xs font-medium text-violet-200"
                >
                  <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t.result.goToBlockFix}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Real Ping Status Panel */}
        <div className="rounded-xl bg-[#07040F] border border-violet-500/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-white">
                {t.result.pingCheckTitle}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {isPinging
                  ? t.result.pingCheckingDesc
                  : parsedEndpoint
                    ? t.result.pingNodePrefix(`${parsedEndpoint.host}:${parsedEndpoint.port}`)
                    : t.result.pingNodeMissing}
              </p>
            </div>

            <button
              type="button"
              disabled={isPinging}
              onClick={() => void runRealPing(record)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-violet-950/70 hover:bg-violet-900/70 border border-violet-500/25 disabled:opacity-60 text-slate-100 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              {isPinging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-violet-300" aria-hidden="true" />
                  <span>{t.result.checkingPing}</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 text-violet-300" aria-hidden="true" />
                  <span>{t.result.checkPingBtn}</span>
                </>
              )}
            </button>
          </div>

          {record.lastPing && !isPinging && (
            <div
              data-testid="ping-result-box"
              className={`pt-3 border-t border-violet-500/15 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm ${
                record.lastPing.reachable ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {record.lastPing.reachable && record.lastPing.latencyMs !== null ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden="true" />
                    <span className="tabular-nums">
                      {t.result.serverReachable(record.lastPing.latencyMs)}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{pingErrorText}</span>
                  </>
                )}
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {new Date(record.lastPing.checkedAt).toLocaleTimeString(localeCode)}
              </span>
            </div>
          )}
        </div>

        {/* Result Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            disabled={!hasConfig}
            onClick={handleCopy}
            className={`inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl text-sm font-semibold transition-colors ${
              hasConfig
                ? 'bg-violet-950/70 hover:bg-violet-900/70 border border-violet-500/25 text-white'
                : 'bg-[#090514] text-slate-600 border border-violet-950/40 cursor-not-allowed'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">{t.result.copiedBtn}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-violet-300" aria-hidden="true" />
                <span>{t.result.copyBtn}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyAndExit}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-violet-950/60 transition-all"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>{t.result.copyAndExitBtn}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
