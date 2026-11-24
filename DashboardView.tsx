import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Unlock,
} from 'lucide-react';
import { getCountryDisplayName, type Translations } from '../i18n/translations';
import type {
  AppLanguage,
  ProtocolConfigTemplate,
  VpnCodeRecord,
  VpnCountry,
  VpnProtocol,
} from '../types/vpn';
import { copyToClipboard } from '../utils/storage';
import {
  COUNTRY_META,
  formatDurationLabel,
  formatRemainingCountdown,
  getSafeCountryMeta,
  normalizeVpnCountry,
  VPN_COUNTRIES,
  VPN_PROTOCOLS,
} from '../utils/vpnParser';

interface DashboardViewProps {
  codes: VpnCodeRecord[];
  blockTemplates: ProtocolConfigTemplate[];
  isSecurityUnlocked: boolean;
  language: AppLanguage;
  t: Translations;
  onStartCreate: () => void;
  onOpenSettings: () => void;
  onOpenSecurityBlock: () => void;
  onSelectCode: (record: VpnCodeRecord, startInEdit?: boolean) => void;
  onDeleteCode: (id: string) => Promise<void> | void;
  onNotifyCopied: (recordName?: string) => void;
}

export function DashboardView({
  codes,
  blockTemplates,
  isSecurityUnlocked,
  language,
  t,
  onStartCreate,
  onOpenSettings,
  onOpenSecurityBlock,
  onSelectCode,
  onDeleteCode,
  onNotifyCopied,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState<VpnProtocol | 'ALL'>('ALL');
  const [countryFilter, setCountryFilter] = useState<VpnCountry | 'ALL'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const stats = useMemo(() => {
    const withConfig = codes.filter((c) => c.rawConfig.trim().length > 0).length;
    return {
      total: codes.length,
      withConfig,
      templatesCount: blockTemplates.filter((b) => b.rawConfig.trim().length > 0).length,
    };
  }, [codes, blockTemplates]);

  const filteredCodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return codes.filter((item) => {
      const normalizedCountry = normalizeVpnCountry(item.country);
      const localizedCountry = getCountryDisplayName(normalizedCountry, language).toLowerCase();
      if (protocolFilter !== 'ALL' && item.protocol !== protocolFilter) return false;
      if (countryFilter !== 'ALL' && normalizedCountry !== countryFilter) return false;
      if (
        q &&
        !item.name.toLowerCase().includes(q) &&
        !localizedCountry.includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [codes, searchQuery, protocolFilter, countryFilter, language]);

  const handleQuickCopy = async (record: VpnCodeRecord) => {
    if (!record.rawConfig.trim()) return;
    const ok = await copyToClipboard(record.rawConfig);
    if (ok) {
      setCopiedId(record.id);
      onNotifyCopied(record.name);
      setTimeout(() => {
        setCopiedId((prev) => (prev === record.id ? null : prev));
      }, 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Header & Quick Access Grid */}
      <section className="rounded-2xl bg-[#0F091F] border border-violet-500/20 p-5 sm:p-6 shadow-xl shadow-black/30">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              VEXTON VPN
            </h1>
            <p className="text-sm text-slate-300/80 max-w-2xl">
              {t.dashboard.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onStartCreate}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:-translate-y-0.5 active:scale-[0.98] text-white text-sm font-semibold shadow-lg shadow-violet-950/60 transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t.nav.addButton}</span>
          </button>
        </div>

        {/* Summary Metrics (Tabular, Zero-Pill) */}
        <div className="mt-6 pt-5 border-t border-violet-500/15 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap truncate">
              {t.dashboard.totalCodes}
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-white tabular-nums">
              {stats.total}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap truncate">
              {t.dashboard.withConfig}
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-violet-300 tabular-nums">
              {stats.withConfig}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap truncate">
              {t.dashboard.templatesCount}
            </p>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-purple-300 tabular-nums">
              {stats.templatesCount}
            </p>
          </div>
        </div>
      </section>

      {/* Main Screen Action Sections: Настройки & Защитный ключ */}
      <section aria-label={t.nav.mainNavLabel} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onOpenSettings}
          className="group text-left rounded-2xl bg-[#0F091F] hover:bg-[#150D2B] hover:-translate-y-0.5 active:scale-[0.99] border border-violet-500/20 hover:border-violet-400/45 p-5 transition-all duration-150 flex items-start justify-between gap-4 min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold text-white group-hover:text-violet-200 transition-colors">
              <Settings className="w-4 h-4 text-violet-400 shrink-0" aria-hidden="true" />
              <span>{t.nav.settings}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              {t.dashboard.settingsCardDesc}
            </p>
          </div>
          <span className="text-xs font-medium text-violet-300 whitespace-nowrap shrink-0 mt-0.5">
            {t.dashboard.openAction}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenSecurityBlock}
          className="group text-left rounded-2xl bg-[#0F091F] hover:bg-[#150D2B] hover:-translate-y-0.5 active:scale-[0.99] border border-violet-500/20 hover:border-purple-400/45 p-5 transition-all duration-150 flex items-start justify-between gap-4 min-h-[88px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold text-white group-hover:text-violet-200 transition-colors">
              <KeyRound className="w-4 h-4 text-purple-400 shrink-0" aria-hidden="true" />
              <span>{t.nav.securityKey}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              {t.dashboard.securityCardDesc}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 whitespace-nowrap shrink-0 mt-0.5">
            {isSecurityUnlocked ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-400">{t.dashboard.statusUnlocked}</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
                <span className="text-violet-300">
                  {t.dashboard.statusCheck}
                </span>
              </>
            )}
          </span>
        </button>
      </section>

      {/* Created VPN Codes List Section */}
      <section className="rounded-2xl bg-[#0F091F] border border-violet-500/20 overflow-hidden">
        <div className="p-5 border-b border-violet-500/15 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">{t.dashboard.listTitle}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.dashboard.listSubtitle}
              </p>
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              {t.dashboard.shownCount(filteredCodes.length, codes.length)}
            </span>
          </div>

          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <label htmlFor="codes-search" className="sr-only">
                {t.dashboard.searchLabel}
              </label>
              <input
                id="codes-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.dashboard.searchPlaceholder}
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label htmlFor="filter-protocol" className="sr-only">
                {t.dashboard.protocolFilterLabel}
              </label>
              <select
                id="filter-protocol"
                value={protocolFilter}
                onChange={(e) => setProtocolFilter(e.target.value as VpnProtocol | 'ALL')}
                className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm text-slate-100 focus:outline-none focus:border-violet-400"
              >
                <option value="ALL">{t.dashboard.allProtocols}</option>
                {VPN_PROTOCOLS.map((proto) => (
                  <option key={proto} value={proto}>
                    {proto}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-country" className="sr-only">
                {t.dashboard.countryFilterLabel}
              </label>
              <select
                id="filter-country"
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value as VpnCountry | 'ALL')}
                className="w-full h-11 px-3.5 rounded-xl bg-[#07040F] border border-violet-500/20 text-sm text-slate-100 focus:outline-none focus:border-violet-400"
              >
                <option value="ALL">{t.dashboard.allCountries}</option>
                {VPN_COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {COUNTRY_META[country].flag} {getCountryDisplayName(country, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="px-5 py-3 bg-rose-950/35 border-b border-rose-500/35 flex items-center gap-2 text-xs sm:text-sm font-medium text-rose-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Empty or Filtered States */}
        {codes.length === 0 ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center mx-auto text-violet-300">
              <Plus className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">
                {t.dashboard.emptyTitle}
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                {t.dashboard.emptyDesc}
              </p>
            </div>
            <button
              type="button"
              onClick={onStartCreate}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-semibold shadow-md shadow-violet-950/50 transition-all"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{t.dashboard.createFirstBtn}</span>
            </button>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-200">
              {t.dashboard.noFilterMatch}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setProtocolFilter('ALL');
                setCountryFilter('ALL');
              }}
              className="text-xs font-medium text-violet-300 hover:text-violet-200 underline"
            >
              {t.dashboard.resetFilters}
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-violet-500/15" data-testid="vpn-codes-list">
            {filteredCodes.map((record) => {
              const countdown = formatRemainingCountdown(record.expiresAt, Date.now(), language);
              const durationText = formatDurationLabel(
                record.durationAmount,
                record.durationUnit,
                language
              );
              const safeMeta = getSafeCountryMeta(record.country);
              const countryLabel = getCountryDisplayName(safeMeta.country, language);
              const displayName = record.name?.trim() || t.dashboard.fallbackCodeName;
              const hasConfig = record.rawConfig.trim().length > 0;
              const isConfirmingDelete = confirmDeleteId === record.id;

              return (
                <li
                  key={record.id}
                  data-testid={`vpn-code-item-${record.id}`}
                  className="p-4 sm:px-6 sm:py-4 hover:bg-violet-950/25 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {/* Flag + Translated Country Name + Saved Code Name displayed prominently side-by-side */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onSelectCode(record, false)}
                        className="inline-flex items-center gap-2 text-left text-base font-bold text-white hover:text-violet-300 transition-colors break-words min-w-0"
                      >
                        <span className="shrink-0 text-lg leading-none" aria-hidden="true">
                          {safeMeta.flag}
                        </span>
                        <span className="text-violet-200 font-semibold shrink-0">
                          {countryLabel}
                        </span>
                        <span className="text-violet-500/70 shrink-0" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-white break-all">{displayName}</span>
                      </button>

                      {record.lastPing && (
                        <span
                          className={`text-xs font-mono tabular-nums shrink-0 ${
                            record.lastPing.reachable
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {record.lastPing.reachable && record.lastPing.latencyMs !== null
                            ? t.dashboard.pingMs(record.lastPing.latencyMs)
                            : t.dashboard.pingUnreachableShort}
                        </span>
                      )}
                    </div>

                    {/* Clean unboxed typographic metadata */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 tabular-nums">
                      <span className="font-medium text-violet-300">{record.protocol}</span>
                      <span aria-hidden="true">·</span>
                      <span className={countdown.expired ? 'text-rose-400' : 'text-slate-300'}>
                        {countdown.label} ({durationText})
                      </span>
                      <span aria-hidden="true">·</span>
                      {hasConfig ? (
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <Check className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
                          <span>{t.dashboard.configAttached}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{t.dashboard.configMissing}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onSelectCode(record, false)}
                      aria-label={`${t.dashboard.openBtn} ${displayName}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl bg-violet-950/60 hover:bg-violet-900/60 border border-violet-500/20 text-slate-100 text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
                      <span>{t.dashboard.openBtn}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectCode(record, true)}
                      aria-label={`${t.dashboard.editBtn} ${displayName}`}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl bg-[#07040F] hover:bg-violet-900/50 border border-violet-500/25 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <Pencil className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
                      <span>{t.dashboard.editBtn}</span>
                    </button>

                    <button
                      type="button"
                      disabled={!hasConfig}
                      onClick={() => handleQuickCopy(record)}
                      aria-label={`${t.dashboard.copyBtn} ${displayName}`}
                      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                        hasConfig
                          ? 'bg-violet-600/20 hover:bg-violet-600/35 text-violet-200 border border-violet-500/35'
                          : 'bg-[#090514] text-slate-600 border border-violet-950/40 cursor-not-allowed'
                      }`}
                    >
                      {copiedId === record.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                          <span className="text-emerald-300">{t.dashboard.copiedBtn}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{t.dashboard.copyBtn}</span>
                        </>
                      )}
                    </button>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={deletingId === record.id}
                          onClick={async () => {
                            setDeletingId(record.id);
                            setActionError('');
                            try {
                              await onDeleteCode(record.id);
                              setConfirmDeleteId(null);
                            } catch (err) {
                              setActionError(
                                err instanceof Error && err.message
                                  ? err.message
                                  : t.errors.deleteFailed
                              );
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          className="px-3 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          {deletingId === record.id ? '...' : t.dashboard.confirmDeleteBtn}
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === record.id}
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl bg-violet-950/60 hover:bg-violet-900/60 disabled:opacity-60 text-slate-300 text-xs font-medium whitespace-nowrap"
                        >
                          {t.dashboard.cancelBtn}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(record.id)}
                        aria-label={`${t.dashboard.confirmDeleteBtn} ${displayName}`}
                        className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-xl bg-[#07040F] hover:bg-rose-950/60 border border-violet-500/20 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-colors"
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
  );
}
