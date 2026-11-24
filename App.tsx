import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { AdminLoginView } from './components/AdminLoginView';
import { AppShell } from './components/AppShell';
import { CodeResultView } from './components/CodeResultView';
import { CreateCodeWizard } from './components/CreateCodeWizard';
import { DashboardView } from './components/DashboardView';
import { SecurityBlockView } from './components/SecurityBlockView';
import { SettingsView } from './components/SettingsView';
import { TRANSLATIONS } from './i18n/translations';
import {
  verifySecurityKeyOnServer,
  type SecurityVerifyErrorCode,
} from './services/pingService';
import {
  checkAdminSession,
  clearAllCodesOnServer,
  createCodeOnServer,
  deleteCodeOnServer,
  deleteTemplateOnServer,
  fetchWorkspaceFromServer,
  loginAdmin,
  logoutAdmin,
  migrateLegacyWorkspaceToServer,
  saveArchitectureOnServer,
  ServerRequestError,
  subscribeToRealtimeSync,
  UnauthorizedError,
  updateCodeOnServer,
  upsertTemplateOnServer,
  type SyncConnectionStatus,
  type SyncSocketSubscription,
} from './services/syncClient';
import type {
  AppLanguage,
  AppScreen,
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  SyncSocketEvent,
  VpnCodeRecord,
} from './types/vpn';
import {
  clearLegacySharedStorageKeys,
  DEFAULT_ARCHITECTURE_CONFIG,
  loadBase64Preference,
  loadLanguage,
  readLegacyWorkspaceForMigration,
  saveBase64Preference,
  saveLanguage,
} from './utils/storage';

interface CopyToastState {
  id: number;
  name?: string;
}

type AuthStatus = 'checking' | 'unauthenticated' | 'authenticated';

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');
  const [adminUsername, setAdminUsername] = useState<string>('admin');
  const [syncStatus, setSyncStatus] = useState<SyncConnectionStatus>('offline');
  const [connectedDevices, setConnectedDevices] = useState<number>(1);

  const [activeScreen, setActiveScreen] = useState<AppScreen>('dashboard');
  const [language, setLanguage] = useState<AppLanguage>(() => loadLanguage());
  const [codes, setCodes] = useState<VpnCodeRecord[]>([]);
  const [blockTemplates, setBlockTemplates] = useState<ProtocolConfigTemplate[]>([]);
  const [architecture, setArchitecture] = useState<ServerArchitectureConfig>(() => ({
    ...DEFAULT_ARCHITECTURE_CONFIG,
    convertVlessToBase64: loadBase64Preference(),
  }));

  // Access to "Исправление блока" is strictly transient and always locks on exit/entry/reload
  const [isSecurityUnlocked, setIsSecurityUnlocked] = useState<boolean>(false);

  const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
  const [openSelectedInEdit, setOpenSelectedInEdit] = useState<boolean>(false);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<CopyToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const syncSubRef = useRef<SyncSocketSubscription | null>(null);
  const workspaceRevisionRef = useRef<number>(0);
  const architectureRef = useRef<ServerArchitectureConfig>(architecture);

  const t = TRANSLATIONS[language];

  useEffect(() => {
    architectureRef.current = architecture;
  }, [architecture]);

  useEffect(() => {
    saveLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const toFriendlyErrorMessage = useCallback(
    (err: unknown, action: 'load' | 'save' | 'delete'): string => {
      if (err instanceof ServerRequestError) {
        if (err.errorCode === 'STORAGE_ERROR' || err.status === 503) {
          return t.errors.storageUnavailable;
        }
        if (err.message) {
          return err.message;
        }
      }
      if (err instanceof Error && err.message && !(err instanceof UnauthorizedError)) {
        return err.message;
      }
      if (action === 'load') return t.errors.loadFailed;
      if (action === 'delete') return t.errors.deleteFailed;
      return t.errors.saveFailed;
    },
    [t]
  );

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof UnauthorizedError) {
      setAuthStatus('unauthenticated');
      setIsSecurityUnlocked(false);
    }
  }, []);

  const loadWorkspaceWithMigration = useCallback(async () => {
    const legacy = readLegacyWorkspaceForMigration();
    if (legacy.codes.length > 0 || legacy.blockTemplates.length > 0) {
      const migrated = await migrateLegacyWorkspaceToServer(legacy);
      clearLegacySharedStorageKeys();
      setCodes(migrated.codes);
      setBlockTemplates(migrated.blockTemplates);
      const nextArch: ServerArchitectureConfig = {
        ...migrated.architecture,
        convertVlessToBase64: Boolean(migrated.architecture.convertVlessToBase64),
      };
      architectureRef.current = nextArch;
      setArchitecture(nextArch);
      saveBase64Preference(Boolean(nextArch.convertVlessToBase64));
      if (typeof migrated.revision === 'number') {
        workspaceRevisionRef.current = migrated.revision;
        syncSubRef.current?.markMutation(migrated.revision);
      }
      if (typeof migrated.connectedDevices === 'number') {
        setConnectedDevices(Math.max(1, migrated.connectedDevices));
      }
      setWorkspaceError(null);
      return;
    }

    const data = await fetchWorkspaceFromServer();
    setCodes(data.codes);
    setBlockTemplates(data.blockTemplates);
    const nextArch: ServerArchitectureConfig = {
      ...data.architecture,
      convertVlessToBase64: Boolean(data.architecture.convertVlessToBase64),
    };
    architectureRef.current = nextArch;
    setArchitecture(nextArch);
    saveBase64Preference(Boolean(nextArch.convertVlessToBase64));
    if (typeof data.revision === 'number') {
      workspaceRevisionRef.current = data.revision;
      syncSubRef.current?.markMutation(data.revision);
    }
    if (typeof data.connectedDevices === 'number') {
      setConnectedDevices(Math.max(1, data.connectedDevices));
    }
    setWorkspaceError(null);
  }, []);

  // Verify existing admin session on boot and fetch latest data from server
  useEffect(() => {
    let active = true;
    (async () => {
      const session = await checkAdminSession();
      if (!active) return;
      if (!session.authenticated) {
        setAuthStatus('unauthenticated');
        return;
      }
      setAdminUsername(session.username || 'admin');
      try {
        await loadWorkspaceWithMigration();
        if (active) setAuthStatus('authenticated');
      } catch (err) {
        if (!active) return;
        handleApiError(err);
        if (err instanceof UnauthorizedError) {
          setAuthStatus('unauthenticated');
        } else {
          setWorkspaceError(toFriendlyErrorMessage(err, 'load'));
          setAuthStatus('authenticated');
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadWorkspaceWithMigration, handleApiError, toFriendlyErrorMessage]);

  const applySyncEvent = useCallback((event: SyncSocketEvent) => {
    switch (event.type) {
      case 'sync:connected':
        setConnectedDevices(Math.max(1, event.connectedClients));
        break;
      case 'clients:count':
        setConnectedDevices(Math.max(1, event.count));
        break;
      case 'code:created':
        setCodes((prev) => {
          const exists = prev.some((item) => item.id === event.record.id);
          if (exists) {
            return prev.map((item) =>
              item.id === event.record.id ? event.record : item
            );
          }
          return [event.record, ...prev];
        });
        break;
      case 'code:updated':
        setCodes((prev) => {
          const exists = prev.some((item) => item.id === event.record.id);
          if (!exists) return [event.record, ...prev];
          return prev.map((item) =>
            item.id === event.record.id ? event.record : item
          );
        });
        break;
      case 'code:deleted':
        setCodes((prev) => prev.filter((item) => item.id !== event.id));
        setSelectedCodeId((prevId) => {
          if (prevId === event.id) {
            setActiveScreen('dashboard');
            return null;
          }
          return prevId;
        });
        break;
      case 'codes:cleared':
        setCodes([]);
        setSelectedCodeId(null);
        break;
      case 'template:upserted':
        setBlockTemplates((prev) => {
          const idx = prev.findIndex(
            (tpl) =>
              tpl.id === event.template.id ||
              (tpl.protocol === event.template.protocol &&
                tpl.countryScope === event.template.countryScope)
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = event.template;
            return next;
          }
          return [event.template, ...prev];
        });
        break;
      case 'template:deleted':
        setBlockTemplates((prev) => prev.filter((tpl) => tpl.id !== event.id));
        break;
      case 'architecture:updated': {
        const nextArch: ServerArchitectureConfig = {
          ...event.architecture,
          convertVlessToBase64: Boolean(event.architecture.convertVlessToBase64),
        };
        architectureRef.current = nextArch;
        setArchitecture(nextArch);
        saveBase64Preference(Boolean(nextArch.convertVlessToBase64));
        break;
      }
      case 'workspace:sync': {
        setCodes(event.codes);
        setBlockTemplates(event.blockTemplates);
        const nextArch: ServerArchitectureConfig = {
          ...event.architecture,
          convertVlessToBase64: Boolean(event.architecture.convertVlessToBase64),
        };
        architectureRef.current = nextArch;
        setArchitecture(nextArch);
        saveBase64Preference(Boolean(nextArch.convertVlessToBase64));
        if (typeof event.revision === 'number') {
          workspaceRevisionRef.current = event.revision;
        }
        setWorkspaceError(null);
        setSelectedCodeId((prevId) => {
          if (prevId && !event.codes.some((item) => item.id === prevId)) {
            setActiveScreen('dashboard');
            return null;
          }
          return prevId;
        });
        break;
      }
    }
  }, []);

  // Subscribe to real-time WebSocket / polling updates while authenticated
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setSyncStatus('offline');
      return;
    }

    const sub = subscribeToRealtimeSync({
      initialRevision: workspaceRevisionRef.current,
      onEvent: applySyncEvent,
      onStatusChange: setSyncStatus,
      onReconnectResync: () => {
        void fetchWorkspaceFromServer()
          .then((data) => {
            setCodes(data.codes);
            setBlockTemplates(data.blockTemplates);
            const nextArch: ServerArchitectureConfig = {
              ...data.architecture,
              convertVlessToBase64: Boolean(data.architecture.convertVlessToBase64),
            };
            architectureRef.current = nextArch;
            setArchitecture(nextArch);
            saveBase64Preference(Boolean(nextArch.convertVlessToBase64));
            if (typeof data.revision === 'number') {
              workspaceRevisionRef.current = data.revision;
              syncSubRef.current?.markMutation(data.revision);
            }
            setWorkspaceError(null);
          })
          .catch((err) => {
            handleApiError(err);
            if (!(err instanceof UnauthorizedError)) {
              setWorkspaceError(toFriendlyErrorMessage(err, 'load'));
            }
          });
      },
    });
    syncSubRef.current = sub;

    return () => {
      if (syncSubRef.current === sub) {
        syncSubRef.current = null;
      }
      sub.close();
    };
  }, [authStatus, applySyncEvent, handleApiError, toFriendlyErrorMessage]);

  const showCopyToast = (recordName?: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setCopyToast({ id: Date.now(), name: recordName });
    toastTimerRef.current = window.setTimeout(() => {
      setCopyToast(null);
      toastTimerRef.current = null;
    }, 2600);
  };

  /**
   * Central screen switcher:
   * Always locks the protected "Исправление блока" section when navigating away
   * OR when opening it anew so the security key is required on every entry.
   */
  const navigateTo = (screen: AppScreen) => {
    if (screen === 'security_block' || activeScreen === 'security_block') {
      setIsSecurityUnlocked(false);
    }
    setActiveScreen(screen);
  };

  const handleAdminLogin = async (username: string, password: string) => {
    const result = await loginAdmin(username, password);
    if (!result.authenticated) {
      return result;
    }
    setAdminUsername(result.username || 'admin');
    try {
      await loadWorkspaceWithMigration();
      setAuthStatus('authenticated');
      setActiveScreen('dashboard');
      return { authenticated: true };
    } catch {
      return { authenticated: false, errorCode: 'SERVER_ERROR' as const };
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    // Never delete persisted codes/templates on logout; only clear client UI state
    setAuthStatus('unauthenticated');
    setIsSecurityUnlocked(false);
    setSelectedCodeId(null);
    setWorkspaceError(null);
    setCodes([]);
    setBlockTemplates([]);
    setActiveScreen('dashboard');
  };

  const selectedRecord =
    codes.find((item) => item.id === selectedCodeId) ?? null;

  const handleStartCreate = () => {
    setOpenSelectedInEdit(false);
    navigateTo('create');
  };

  const handleCreateComplete = async (record: VpnCodeRecord) => {
    try {
      const saved = await createCodeOnServer(record);
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'code:created', record: saved });
      setWorkspaceError(null);
      setSelectedCodeId(saved.id);
      setOpenSelectedInEdit(false);
      setJustCreatedId(saved.id);
      navigateTo('result');
    } catch (err) {
      handleApiError(err);
      throw new Error(toFriendlyErrorMessage(err, 'save'));
    }
  };

  const handleUpdateRecord = async (updated: VpnCodeRecord) => {
    try {
      const saved = await updateCodeOnServer(updated.id, updated);
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'code:updated', record: saved });
      setWorkspaceError(null);
    } catch (err) {
      handleApiError(err);
      throw new Error(toFriendlyErrorMessage(err, 'save'));
    }
  };

  const handleDeleteCode = async (id: string) => {
    try {
      await deleteCodeOnServer(id);
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'code:deleted', id });
      setWorkspaceError(null);
    } catch (err) {
      handleApiError(err);
      const message = toFriendlyErrorMessage(err, 'delete');
      setWorkspaceError(message);
      throw new Error(message);
    }
  };

  const handleSelectCode = (record: VpnCodeRecord, startInEdit = false) => {
    setSelectedCodeId(record.id);
    setOpenSelectedInEdit(startInEdit);
    setJustCreatedId(null);
    navigateTo('result');
  };

  const handleVerifySecurityKey = async (
    candidate: string
  ): Promise<{ valid: boolean; errorCode?: SecurityVerifyErrorCode }> => {
    const result = await verifySecurityKeyOnServer(candidate);
    if (result.valid) {
      setIsSecurityUnlocked(true);
    }
    return result;
  };

  const handleSaveTemplate = async (template: ProtocolConfigTemplate) => {
    try {
      const saved = await upsertTemplateOnServer(template);
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'template:upserted', template: saved });
      setWorkspaceError(null);
    } catch (err) {
      handleApiError(err);
      throw new Error(toFriendlyErrorMessage(err, 'save'));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplateOnServer(id);
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'template:deleted', id });
      setWorkspaceError(null);
    } catch (err) {
      handleApiError(err);
      throw new Error(toFriendlyErrorMessage(err, 'delete'));
    }
  };

  const handleSaveArchitecture = async (nextConfig: ServerArchitectureConfig) => {
    const previousConfig = architectureRef.current;
    architectureRef.current = nextConfig;
    saveBase64Preference(Boolean(nextConfig.convertVlessToBase64));
    setArchitecture(nextConfig);
    try {
      const saved = await saveArchitectureOnServer(nextConfig);
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'architecture:updated', architecture: saved });
      setWorkspaceError(null);
    } catch (err) {
      handleApiError(err);
      architectureRef.current = previousConfig;
      saveBase64Preference(Boolean(previousConfig.convertVlessToBase64));
      setArchitecture(previousConfig);
      throw new Error(toFriendlyErrorMessage(err, 'save'));
    }
  };

  const handleToggleBase64 = async (enabled: boolean) => {
    const previousConfig = architectureRef.current;
    const nextConfig: ServerArchitectureConfig = {
      ...previousConfig,
      convertVlessToBase64: enabled,
    };
    architectureRef.current = nextConfig;
    saveBase64Preference(enabled);
    setArchitecture(nextConfig);
    try {
      const saved = await saveArchitectureOnServer(nextConfig);
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'architecture:updated', architecture: saved });
      setWorkspaceError(null);
    } catch (err) {
      handleApiError(err);
      architectureRef.current = previousConfig;
      saveBase64Preference(Boolean(previousConfig.convertVlessToBase64));
      setArchitecture(previousConfig);
      setWorkspaceError(toFriendlyErrorMessage(err, 'save'));
    }
  };

  const handleClearAllCodes = async () => {
    try {
      await clearAllCodesOnServer();
      syncSubRef.current?.markMutation();
      applySyncEvent({ type: 'codes:cleared' });
      setWorkspaceError(null);
    } catch (err) {
      handleApiError(err);
      const message = toFriendlyErrorMessage(err, 'delete');
      setWorkspaceError(message);
      throw new Error(message);
    }
  };

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-300">
        <Loader2 className="w-7 h-7 animate-spin text-violet-400" aria-hidden="true" />
        <p className="text-sm font-medium">{t.auth.checkingSession}</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <AdminLoginView
        language={language}
        t={t}
        onChangeLanguage={setLanguage}
        onLogin={handleAdminLogin}
      />
    );
  }

  return (
    <>
      <AppShell
        activeScreen={activeScreen}
        onNavigate={navigateTo}
        onStartCreate={handleStartCreate}
        onLogout={() => void handleLogout()}
        isSecurityUnlocked={isSecurityUnlocked}
        syncStatus={syncStatus}
        connectedDevices={connectedDevices}
        adminUsername={adminUsername}
        t={t}
      >
        {workspaceError && (
          <div
            role="alert"
            data-testid="workspace-error-banner"
            className="mb-5 rounded-xl bg-rose-950/40 border border-rose-500/45 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs sm:text-sm text-rose-200"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="break-words">{workspaceError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void loadWorkspaceWithMigration().catch((err) => {
                    handleApiError(err);
                    if (!(err instanceof UnauthorizedError)) {
                      setWorkspaceError(toFriendlyErrorMessage(err, 'load'));
                    }
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 text-xs font-semibold text-rose-100"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.errors.retryBtn}</span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceError(null)}
                className="px-2.5 py-1.5 rounded-lg bg-[#07040F]/70 hover:bg-violet-950/60 border border-rose-500/25 text-xs font-medium text-slate-300"
              >
                {t.errors.dismissBtn}
              </button>
            </div>
          </div>
        )}

        {activeScreen === 'dashboard' && (
          <DashboardView
            codes={codes}
            blockTemplates={blockTemplates}
            isSecurityUnlocked={isSecurityUnlocked}
            language={language}
            t={t}
            onStartCreate={handleStartCreate}
            onOpenSettings={() => navigateTo('settings')}
            onOpenSecurityBlock={() => navigateTo('security_block')}
            onSelectCode={handleSelectCode}
            onDeleteCode={handleDeleteCode}
            onNotifyCopied={showCopyToast}
          />
        )}

        {activeScreen === 'create' && (
          <CreateCodeWizard
            blockTemplates={blockTemplates}
            convertVlessToBase64={Boolean(architecture.convertVlessToBase64)}
            language={language}
            t={t}
            onCancel={() => navigateTo('dashboard')}
            onToggleBase64={(enabled) => void handleToggleBase64(enabled)}
            onCreateComplete={handleCreateComplete}
            onOpenSecurityBlock={() => navigateTo('security_block')}
          />
        )}

        {activeScreen === 'result' && selectedRecord && (
          <CodeResultView
            record={selectedRecord}
            blockTemplates={blockTemplates}
            convertVlessToBase64={Boolean(architecture.convertVlessToBase64)}
            autoPingOnOpen={
              architecture.autoPingOnCreate && justCreatedId === selectedRecord.id
            }
            initialEditing={openSelectedInEdit}
            language={language}
            t={t}
            onUpdateRecord={handleUpdateRecord}
            onNotifyCopied={showCopyToast}
            onExitToDashboard={() => {
              setJustCreatedId(null);
              setOpenSelectedInEdit(false);
              navigateTo('dashboard');
            }}
            onOpenSecurityBlock={() => navigateTo('security_block')}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsView
            architecture={architecture}
            codes={codes}
            blockTemplates={blockTemplates}
            codesCount={codes.length}
            isSecurityUnlocked={isSecurityUnlocked}
            language={language}
            t={t}
            onChangeLanguage={setLanguage}
            onBackToDashboard={() => navigateTo('dashboard')}
            onOpenSecurityBlock={() => navigateTo('security_block')}
            onSaveArchitecture={handleSaveArchitecture}
            onClearCodes={handleClearAllCodes}
            onLogout={() => void handleLogout()}
          />
        )}

        {activeScreen === 'security_block' && (
          <SecurityBlockView
            isUnlocked={isSecurityUnlocked}
            blockTemplates={blockTemplates}
            language={language}
            t={t}
            onBackToSettings={() => navigateTo('settings')}
            onVerifySecurityKey={handleVerifySecurityKey}
            onLockSection={() => setIsSecurityUnlocked(false)}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        )}
      </AppShell>

      {/* Global Copy Success Toast Notification */}
      {copyToast && (
        <div
          key={copyToast.id}
          role="status"
          aria-live="polite"
          data-testid="copy-toast"
          className="fixed z-50 bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96 rounded-xl bg-[#130B28]/95 backdrop-blur-md border border-violet-400/45 shadow-2xl shadow-violet-950/80 px-4 py-3.5 flex items-start gap-3 animate-toast-enter"
        >
          <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
            <Check className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">
              {t.toast.copiedTitle}
            </p>
            <p className="text-xs text-slate-300 leading-snug mt-0.5 break-words">
              {t.toast.copiedDesc(copyToast.name)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCopyToast(null)}
            aria-label={t.toast.close}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-violet-900/40 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
