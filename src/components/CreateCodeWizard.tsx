import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Globe,
  KeyRound,
  Loader2,
  Server,
  ShieldCheck,
  Sparkles,
  Tag,
} from 'lucide-react';
import {
  getCountryDisplayName,
  getScopeLabelLocalized,
  type Translations,
} from '../i18n/translations';
import type {
  AppLanguage,
  ProtocolConfigTemplate,
  TimeUnit,
  VpnCodeRecord,
  VpnCountry,
  VpnProtocol,
} from '../types/vpn';
import {
  applyVlessBase64Setting,
  calculateRemainingSeconds,
  COUNTRY_META,
  formatDurationLabel,
  formatVpnConfigLink,
  parseEndpointFromConfig,
  resolveProtocolConfig,
  VPN_COUNTRIES,
  VPN_PROTOCOLS,
} from '../utils/vpnParser';

interface CreateCodeWizardProps {
  blockTemplates: ProtocolConfigTemplate[];
  convertVlessToBase64: boolean;
  language: AppLanguage;
  t: Translations;
  onCancel: () => void;
  onToggleBase64: (enabled: boolean) => void;
  onCreateComplete: (record: VpnCodeRecord) => Promise<void> | void;
  onOpenSecurityBlock: () => void;
}

const PROTOCOL_BADGES: Record<VpnProtocol, { badge: string; transport: string }> = {
  Hysteria: { badge: 'HY2', transport: 'QUIC' },
  ShadowSocks: { badge: 'SS', transport: 'SOCKS5' },
  VLESS: { badge: 'VL', transport: 'XTLS / WS' },
  VMess: { badge: 'VM', transport: 'V2Ray JSON' },
  Trojan: { badge: 'TR', transport: 'HTTPS / TLS' },
};

export function CreateCodeWizard({
  blockTemplates,
  convertVlessToBase64,
  language,
  t,
  onCancel,
  onToggleBase64,
  onCreateComplete,
  onOpenSecurityBlock,
}: CreateCodeWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [protocol, setProtocol] = useState<VpnProtocol>('VLESS');
  const [country, setCountry] = useState<VpnCountry>('Нидерланды');
  const [codeName, setCodeName] = useState<string>('');
  const [durationAmount, setDurationAmount] = useState<number>(30);
  const [durationUnit, setDurationUnit] = useState<TimeUnit>('days');
  const [nameError, setNameError] = useState<string>('');
  const [durationError, setDurationError] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const creationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (creationTimerRef.current !== null) {
        window.clearTimeout(creationTimerRef.current);
      }
    };
  }, []);

  const matchedTemplate = useMemo(
    () => resolveProtocolConfig(blockTemplates, protocol, country),
    [blockTemplates, protocol, country]
  );

  const effectiveRawConfig = useMemo(() => {
    const raw = matchedTemplate?.rawConfig.trim() ?? '';
    if (!raw) return '';
    return formatVpnConfigLink({
      protocol,
      rawConfig: raw,
      country,
      name: codeName,
    });
  }, [matchedTemplate, protocol, country, codeName]);

  const parsedEndpoint = useMemo(
    () => parseEndpointFromConfig(protocol, effectiveRawConfig),
    [protocol, effectiveRawConfig]
  );

  const handleNext = () => {
    if (step === 3) {
      if (!codeName.trim()) {
        setNameError(t.wizard.codeNameErrorEmpty);
        return;
      }
      setNameError('');
    }
    if (step === 4) {
      if (!Number.isFinite(durationAmount) || durationAmount < 1) {
        setDurationError(t.wizard.durationErrorMin);
        return;
      }
      setDurationError('');
    }
    setStep((prev) => Math.min(5, prev + 1));
  };

  const handleBack = () => {
    if (isCreating) return;
    setCreateError('');
    if (step === 1) {
      onCancel();
    } else {
      setStep((prev) => Math.max(1, prev - 1));
    }
  };

  const handleCreateRecord = () => {
    if (isCreating) return;
    const trimmedName = codeName.trim();
    if (!trimmedName) {
      setStep(3);
      setNameError(t.wizard.codeNameErrorEmpty);
      return;
    }

    const safeAmount = Math.max(1, Math.floor(durationAmount));
    const seconds = calculateRemainingSeconds(safeAmount, durationUnit);
    const now = Date.now();
    const expiresAt = new Date(now + seconds * 1000).toISOString();

    const finalRawConfig = applyVlessBase64Setting({
      protocol,
      formattedConfig: effectiveRawConfig,
      convertToBase64: convertVlessToBase64,
    });

    const newRecord: VpnCodeRecord = {
      id:
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `vexton-${now}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      protocol,
      country,
      durationAmount: safeAmount,
      durationUnit,
      durationLabel: formatDurationLabel(safeAmount, durationUnit, language),
      expiresAt,
      createdAt: new Date(now).toISOString(),
      rawConfig: finalRawConfig,
      configSource: finalRawConfig.length > 0 ? 'block_fix' : 'pending',
    };

    setIsCreating(true);
    setCreateError('');
    creationTimerRef.current = window.setTimeout(() => {
      creationTimerRef.current = null;
      void (async () => {
        try {
          await onCreateComplete(newRecord);
        } catch (err) {
          setCreateError(
            err instanceof Error && err.message ? err.message : t.errors.saveFailed
          );
        } finally {
          setIsCreating(false);
        }
      })();
    }, 350);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header & Enhanced Current Step Indicator */}
      <div className="rounded-2xl bg-[#0F091F] border border-violet-500/20 p-5 sm:p-6 space-y-5 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={isCreating}
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-50 min-h-[40px] px-2 -ml-2 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{step === 1 ? t.wizard.backToHome : t.wizard.back}</span>
          </button>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-violet-200 bg-violet-600/20 border border-violet-500/35 px-3 py-1 rounded-lg tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" aria-hidden="true" />
            <span>{t.wizard.stepOf(step)}</span>
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            {t.wizard.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {t.wizard.subtitle}
          </p>
        </div>

        {/* Visual 5-step progress indicator */}
        <ol
          aria-label={t.wizard.stepsAria}
          className="grid grid-cols-5 gap-2 pt-1"
        >
          {t.wizard.steps.map((title, idx) => {
            const number = idx + 1;
            const isCurrent = number === step;
            const isDone = number < step;
            return (
              <li key={number} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0 transition-all duration-200 tabular-nums ${
                      isCurrent
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-900/70 ring-2 ring-violet-400/40'
                        : isDone
                          ? 'bg-violet-600/30 border border-violet-400/50 text-violet-200'
                          : 'bg-[#07040F] border border-violet-500/20 text-slate-500'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : number}
                  </span>
                  <div
                    className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                      isCurrent
                        ? 'bg-gradient-to-r from-violet-400 to-purple-500'
                        : isDone
                          ? 'bg-violet-600'
                          : 'bg-violet-950/80'
                    }`}
                  />
                </div>
                <span
                  className={`block text-[11px] font-medium truncate ${
                    isCurrent
                      ? 'text-violet-200 font-semibold'
                      : isDone
                        ? 'text-slate-300'
                        : 'text-slate-500'
                  }`}
                >
                  {title}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step Content or Creation Animation State */}
      <div className="rounded-2xl bg-[#0F091F] border border-violet-500/20 p-5 sm:p-6 space-y-6 shadow-xl shadow-black/30">
        {isCreating ? (
          <div
            data-testid="code-creation-animation"
            className="py-10 px-4 flex flex-col items-center text-center space-y-5 animate-view-enter"
          >
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full border-2 border-violet-500/20"
                aria-hidden="true"
              />
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 border-r-purple-500 animate-spin"
                aria-hidden="true"
              />
              <div className="w-11 h-11 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-300">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">
                {t.wizard.creatingTitle}
              </h2>
              <p className="text-sm text-slate-400 max-w-md">
                {t.wizard.creatingSubtitle}
              </p>
            </div>

            <div className="w-full max-w-xs h-1.5 rounded-full bg-[#07040F] border border-violet-500/20 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-violet-500 via-purple-400 to-violet-500 animate-progress-sweep" />
            </div>

            <p className="text-xs font-mono text-violet-300">
              {protocol} · {COUNTRY_META[country].flag} {getCountryDisplayName(country, language)} ·{' '}
              {codeName.trim()}
            </p>
          </div>
        ) : (
          <>
            <div key={step} className="animate-step-enter">
              {/* STEP 1: Protocol Cards */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Server className="w-5 h-5 text-violet-400" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-white">{t.wizard.step1Title}</h2>
                  </div>
                  <p className="text-sm text-slate-400">{t.wizard.step1Desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {VPN_PROTOCOLS.map((proto) => {
                      const selected = protocol === proto;
                      const badgeInfo = PROTOCOL_BADGES[proto];
                      const desc = t.protocols[proto];
                      const hasSavedConfig = blockTemplates.some(
                        (tpl) => tpl.protocol === proto && tpl.rawConfig.trim().length > 0
                      );
                      return (
                        <button
                          key={proto}
                          type="button"
                          aria-label={`${proto} — ${desc}`}
                          aria-pressed={selected}
                          onClick={() => setProtocol(proto)}
                          className={`group text-left rounded-xl p-4 border transition-all duration-150 min-h-[84px] flex items-start justify-between gap-3 hover:-translate-y-0.5 active:scale-[0.99] ${
                            selected
                              ? 'bg-violet-600/20 border-violet-400 text-white shadow-md shadow-violet-950/70'
                              : 'bg-[#07040F] border-violet-500/15 hover:border-violet-400/45 text-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`w-10 h-10 rounded-xl font-mono text-xs font-extrabold flex items-center justify-center shrink-0 border transition-colors ${
                                selected
                                  ? 'bg-gradient-to-br from-violet-500 to-purple-600 border-violet-300/40 text-white'
                                  : 'bg-[#120B24] border-violet-500/25 text-violet-300 group-hover:border-violet-400/45'
                              }`}
                            >
                              {badgeInfo.badge}
                            </span>
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-base font-bold text-white">{proto}</p>
                                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-violet-300/80">
                                  {badgeInfo.transport}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                              <p
                                className={`text-[11px] font-medium ${
                                  hasSavedConfig ? 'text-emerald-400' : 'text-slate-500'
                                }`}
                              >
                                ● {hasSavedConfig ? t.wizard.configReadyBadge : t.wizard.configNotSetBadge}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              selected
                                ? 'bg-violet-400 border-violet-400 text-slate-950'
                                : 'border-violet-500/30'
                            }`}
                          >
                            {selected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: Country — strictly the 6 required options with enhanced flag cards */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-5 h-5 text-violet-400" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-white">{t.wizard.step2Title}</h2>
                  </div>
                  <p className="text-sm text-slate-400">{t.wizard.step2Desc}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {VPN_COUNTRIES.map((item) => {
                      const selected = country === item;
                      const meta = COUNTRY_META[item];
                      const localized = t.countries[item];
                      return (
                        <button
                          key={item}
                          type="button"
                          aria-label={`${meta.flag} ${localized.name}`}
                          aria-pressed={selected}
                          onClick={() => setCountry(item)}
                          className={`group text-left rounded-xl p-4 border transition-all duration-150 min-h-[76px] flex items-center justify-between gap-3 hover:-translate-y-0.5 active:scale-[0.99] ${
                            selected
                              ? 'bg-violet-600/20 border-violet-400 text-white shadow-md shadow-violet-950/70'
                              : 'bg-[#07040F] border-violet-500/15 hover:border-violet-400/45 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span
                              className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0 transition-colors ${
                                selected
                                  ? 'bg-violet-500/25 border-violet-400/50'
                                  : 'bg-[#140D2A] border-violet-500/25 group-hover:border-violet-400/45'
                              }`}
                            >
                              {meta.flag}
                            </span>
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="text-base font-semibold text-white truncate">
                                  {localized.name}
                                </p>
                                <span className="text-[10px] font-mono text-violet-300/80">
                                  {meta.code}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">{localized.region}</p>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                              selected
                                ? 'bg-violet-400 border-violet-400 text-slate-950'
                                : 'border-violet-500/30'
                            }`}
                          >
                            {selected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: Code Name */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Tag className="w-5 h-5 text-violet-400" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-white">{t.wizard.step3Title}</h2>
                  </div>
                  <p className="text-sm text-slate-400">{t.wizard.step3Desc}</p>
                  <div className="space-y-2">
                    <label
                      htmlFor="code-name-input"
                      className="block text-sm font-medium text-slate-200"
                    >
                      {t.wizard.codeNameLabel}
                    </label>
                    <input
                      id="code-name-input"
                      type="text"
                      value={codeName}
                      onChange={(e) => {
                        setCodeName(e.target.value);
                        if (nameError) setNameError('');
                      }}
                      placeholder={t.wizard.codeNamePlaceholder}
                      autoFocus
                      className="w-full h-12 px-4 rounded-xl bg-[#07040F] border border-violet-500/30 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                    />
                    {nameError && (
                      <p role="alert" className="text-xs font-medium text-rose-400">
                        {nameError}
                      </p>
                    )}
                  </div>

                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {t.wizard.quickTemplatePrefix}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCodeName(`${protocol}-${COUNTRY_META[country].code}-01`);
                        setNameError('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-violet-950/70 hover:bg-violet-900/70 border border-violet-500/25 text-xs font-mono text-violet-200 transition-colors"
                    >
                      {protocol}-{COUNTRY_META[country].code}-01
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: Remaining Time */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-violet-400" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-white">{t.wizard.step4Title}</h2>
                  </div>
                  <p className="text-sm text-slate-400">{t.wizard.step4Desc}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label
                        htmlFor="duration-amount-input"
                        className="block text-sm font-medium text-slate-200"
                      >
                        {t.wizard.amountLabel}
                      </label>
                      <input
                        id="duration-amount-input"
                        type="number"
                        min={1}
                        max={3650}
                        value={durationAmount}
                        onChange={(e) => {
                          setDurationAmount(Number(e.target.value));
                          if (durationError) setDurationError('');
                        }}
                        className="w-full h-12 px-4 rounded-xl bg-[#07040F] border border-violet-500/30 text-base text-white font-mono tabular-nums focus:outline-none focus:border-violet-400"
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="duration-unit-select"
                        className="block text-sm font-medium text-slate-200"
                      >
                        {t.wizard.unitLabel}
                      </label>
                      <select
                        id="duration-unit-select"
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as TimeUnit)}
                        className="w-full h-12 px-4 rounded-xl bg-[#07040F] border border-violet-500/30 text-base text-white focus:outline-none focus:border-violet-400"
                      >
                        <option value="minutes">{t.wizard.unitMinutes}</option>
                        <option value="hours">{t.wizard.unitHours}</option>
                        <option value="days">{t.wizard.unitDays}</option>
                      </select>
                    </div>
                  </div>

                  {durationError && (
                    <p role="alert" className="text-xs font-medium text-rose-400">
                      {durationError}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { label: t.wizard.preset12h, amount: 12, unit: 'hours' as TimeUnit },
                      { label: t.wizard.preset7d, amount: 7, unit: 'days' as TimeUnit },
                      { label: t.wizard.preset30d, amount: 30, unit: 'days' as TimeUnit },
                      { label: t.wizard.preset90d, amount: 90, unit: 'days' as TimeUnit },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setDurationAmount(preset.amount);
                          setDurationUnit(preset.unit);
                          setDurationError('');
                        }}
                        className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#07040F] hover:bg-violet-950/60 border border-violet-500/20 text-xs font-medium text-slate-200 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl bg-[#07040F] border border-violet-500/20 p-3.5 text-sm text-slate-300 tabular-nums">
                    {t.wizard.selectedDurationPrefix}{' '}
                    <span className="font-semibold text-violet-300">
                      {formatDurationLabel(durationAmount || 1, durationUnit, language)}
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 5: Create Record (Real Server Configuration Binding Only, No Manual Fields) */}
              {step === 5 && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white">{t.wizard.step5Title}</h2>
                    <p className="text-sm text-slate-400">{t.wizard.step5Desc}</p>
                  </div>

                  {/* Summary Table */}
                  <dl className="rounded-xl bg-[#07040F] border border-violet-500/20 divide-y divide-violet-500/15">
                    <div className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                      <dt className="text-slate-400">{t.wizard.summaryName}</dt>
                      <dd className="font-semibold text-white">{codeName.trim()}</dd>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                      <dt className="text-slate-400">{t.wizard.summaryProtocol}</dt>
                      <dd className="font-semibold text-violet-300">{protocol}</dd>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                      <dt className="text-slate-400">{t.wizard.summaryCountry}</dt>
                      <dd className="font-medium text-slate-100">
                        {COUNTRY_META[country].flag} {getCountryDisplayName(country, language)}
                      </dd>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                      <dt className="text-slate-400">{t.wizard.summaryDuration}</dt>
                      <dd className="font-medium text-slate-100 tabular-nums">
                        {formatDurationLabel(durationAmount, durationUnit, language)}
                      </dd>
                    </div>
                  </dl>

                  {/* Real Server Configuration Status (compact status without large raw code block) */}
                  {matchedTemplate ? (
                    <div className="rounded-xl bg-violet-950/35 border border-violet-500/40 px-4 py-3.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-violet-200">
                        <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
                        <span>
                          {t.wizard.templateFound(
                            getScopeLabelLocalized(matchedTemplate.countryScope, language)
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-amber-950/20 border border-amber-500/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div className="text-xs sm:text-sm text-amber-200/90 space-y-1">
                          <p className="font-semibold text-amber-300">
                            {t.wizard.templateMissingTitle(
                              protocol,
                              getCountryDisplayName(country, language)
                            )}
                          </p>
                          <p className="text-amber-200/75">
                            {t.wizard.templateMissingDesc}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenSecurityBlock}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 min-h-[40px] rounded-xl bg-violet-950/80 hover:bg-violet-900/80 border border-violet-500/25 text-xs font-medium text-violet-200 whitespace-nowrap shrink-0"
                      >
                        <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t.wizard.blockFixBtn}</span>
                      </button>
                    </div>
                  )}

                  {/* Base64 Subscription Toggle Setting */}
                  <div className="rounded-xl bg-[#07040F] border border-violet-500/25 p-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {t.wizard.base64ToggleTitle}
                        </p>
                        <p
                          className={`text-xs font-medium ${
                            convertVlessToBase64 ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {convertVlessToBase64
                            ? t.wizard.base64ToggleOn
                            : t.wizard.base64ToggleOff}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={convertVlessToBase64}
                        aria-label={t.wizard.base64ToggleTitle}
                        data-testid="base64-toggle-switch"
                        onClick={() => onToggleBase64(!convertVlessToBase64)}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                          convertVlessToBase64
                            ? 'bg-gradient-to-r from-violet-500 to-purple-500 border-violet-300/60 shadow-inner shadow-violet-950/40'
                            : 'bg-[#140D2A] border-violet-500/35'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                            convertVlessToBase64 ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {t.wizard.base64ToggleDesc}
                    </p>
                    {protocol !== 'VLESS' && (
                      <p className="text-[11px] text-violet-300/80">
                        {t.wizard.base64NonVlessNote}
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-slate-400">
                    {parsedEndpoint ? (
                      <span>
                        {t.wizard.detectedEndpoint}{' '}
                        <strong className="font-mono text-violet-300">
                          {parsedEndpoint.host}:{parsedEndpoint.port}
                        </strong>
                      </span>
                    ) : (
                      <span>{t.wizard.noEndpointDetected}</span>
                    )}
                  </div>

                  {createError && (
                    <div
                      role="alert"
                      data-testid="create-error-alert"
                      className="rounded-xl bg-rose-950/35 border border-rose-500/40 p-3.5 text-xs sm:text-sm font-medium text-rose-300"
                    >
                      {createError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wizard Footer Controls */}
            <div className="pt-4 border-t border-violet-500/15 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2.5 min-h-[44px] rounded-xl bg-violet-950/60 hover:bg-violet-900/60 border border-violet-500/20 text-slate-200 text-sm font-medium transition-colors"
              >
                {step === 1 ? t.wizard.cancel : t.wizard.back}
              </button>

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold shadow-md shadow-violet-950/50 transition-all"
                >
                  <span>{t.wizard.next}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreateRecord}
                  className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-60 text-white text-sm font-semibold shadow-md shadow-violet-950/50 transition-all"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{t.wizard.createRecord}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
