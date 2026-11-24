import type {
  AppLanguage,
  CountryScope,
  PingErrorCode,
  VpnCountry,
  VpnProtocol,
} from '../types/vpn';

export interface LanguageOption {
  code: AppLanguage;
  flag: string;
  label: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'ru', flag: '🇷🇺', label: 'Русский' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'tk', flag: '🇹🇲', label: 'Türkmençe' },
] as const;

export interface Translations {
  auth: {
    loginTitle: string;
    loginSubtitle: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    showPassword: string;
    hidePassword: string;
    loginBtn: string;
    loggingInBtn: string;
    logoutBtn: string;
    errEmptyPassword: string;
    errInvalidCredentials: string;
    errServerError: string;
    errMissingEnvVars: string;
    securityNote: string;
    checkingSession: string;
  };
  sync: {
    connectedLive: string;
    reconnecting: string;
    offline: string;
    devicesOnline: (count: number) => string;
    serverDbLabel: string;
  };
  nav: {
    mainPanel: string;
    createCode: string;
    settings: string;
    securityKey: string;
    mobileHome: string;
    mobileAdd: string;
    mobileSettings: string;
    mobileKey: string;
    mainNavLabel: string;
    mobileNavLabel: string;
    localStorageTitle: string;
    blockUnlockedNote: string;
    blockLockedNote: string;
    addButton: string;
  };
  screens: {
    dashboard: string;
    create: string;
    result: string;
    settings: string;
    security_block: string;
  };
  toast: {
    copiedTitle: string;
    copiedDesc: (name?: string) => string;
    close: string;
  };
  dashboard: {
    subtitle: string;
    totalCodes: string;
    withConfig: string;
    templatesCount: string;
    settingsCardDesc: string;
    openAction: string;
    securityCardDesc: string;
    statusUnlocked: string;
    statusCheck: string;
    listTitle: string;
    listSubtitle: string;
    shownCount: (shown: number, total: number) => string;
    searchPlaceholder: string;
    searchLabel: string;
    allProtocols: string;
    protocolFilterLabel: string;
    allCountries: string;
    countryFilterLabel: string;
    emptyTitle: string;
    emptyDesc: string;
    createFirstBtn: string;
    noFilterMatch: string;
    resetFilters: string;
    pingUnreachableShort: string;
    pingMs: (ms: number) => string;
    configAttached: string;
    configMissing: string;
    fallbackCodeName: string;
    openBtn: string;
    editBtn: string;
    copyBtn: string;
    copiedBtn: string;
    confirmDeleteBtn: string;
    cancelBtn: string;
  };
  wizard: {
    backToHome: string;
    back: string;
    stepOf: (step: number) => string;
    title: string;
    subtitle: string;
    stepsAria: string;
    steps: [string, string, string, string, string];
    step1Title: string;
    step1Desc: string;
    configReadyBadge: string;
    configNotSetBadge: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    codeNameLabel: string;
    codeNamePlaceholder: string;
    codeNameErrorEmpty: string;
    quickTemplatePrefix: string;
    step4Title: string;
    step4Desc: string;
    amountLabel: string;
    unitLabel: string;
    unitMinutes: string;
    unitHours: string;
    unitDays: string;
    durationErrorMin: string;
    preset12h: string;
    preset7d: string;
    preset30d: string;
    preset90d: string;
    selectedDurationPrefix: string;
    step5Title: string;
    step5Desc: string;
    summaryName: string;
    summaryProtocol: string;
    summaryCountry: string;
    summaryDuration: string;
    templateFound: (scopeLabel: string) => string;
    boundConfigLabel: string;
    base64ToggleTitle: string;
    base64ToggleDesc: string;
    base64ToggleOn: string;
    base64ToggleOff: string;
    base64NonVlessNote: string;
    templateMissingTitle: (protocol: string, country: string) => string;
    templateMissingDesc: string;
    blockFixBtn: string;
    detectedEndpoint: string;
    noEndpointDetected: string;
    creatingTitle: string;
    creatingSubtitle: string;
    cancel: string;
    next: string;
    createRecord: string;
  };
  result: {
    backToHome: string;
    createdAt: (dateStr: string) => string;
    editRecordBtn: string;
    editTitle: string;
    editNameLabel: string;
    editNamePlaceholder: string;
    editNameError: string;
    editCountryLabel: string;
    editDurationAmountLabel: string;
    editDurationUnitLabel: string;
    editConfigLabel: string;
    editConfigPlaceholder: string;
    saveRecordBtn: string;
    savingRecordBtn: string;
    savedRecordNotice: string;
    cancelEditBtn: string;
    realServerConfigTitle: string;
    sourceBlockFix: string;
    sourceBase64Badge: string;
    configReadyTitle: string;
    configReadyDesc: string;
    noConfigTitle: string;
    noConfigDesc: string;
    syncFromBlockBtn: string;
    goToBlockFix: string;
    pingCheckTitle: string;
    pingCheckingDesc: string;
    pingNodePrefix: (hostPort: string) => string;
    pingNodeMissing: string;
    checkingPing: string;
    checkPingBtn: string;
    serverReachable: (ms: number) => string;
    serverUnreachable: string;
    copyBtn: string;
    copiedBtn: string;
    copyAndExitBtn: string;
  };
  settings: {
    backToHome: string;
    title: string;
    subtitle: string;
    languageTitle: string;
    languageDesc: string;
    languageSaved: string;
    breadcrumbSettings: string;
    breadcrumbKey: string;
    breadcrumbBlockFix: string;
    securitySectionTitle: string;
    securitySectionDesc: string;
    savedConfigsMeta: (count: number) => string;
    statusLabel: string;
    statusUnlocked: string;
    statusNeedCheck: string;
    openSecurityKeyBtn: string;
    archTitle: string;
    archDesc: string;
    adapterModeLabel: string;
    adapterModeLocal: string;
    adapterModeRest: string;
    authHeaderLabel: string;
    apiBaseUrlLabel: string;
    syncPathLabel: string;
    autoPingCheckbox: string;
    base64ToggleTitle: string;
    base64ToggleDesc: string;
    saveSettingsBtn: string;
    savedBtn: string;
    localStorageTitle: string;
    localStorageDesc: string;
    exportJsonBtn: string;
    confirmClearBtn: (count: number) => string;
    cancelBtn: string;
    clearAllCodesBtn: string;
    logoutAdminBtn: string;
  };
  securityBlock: {
    backToSettings: string;
    verifyTitle: string;
    verifyDesc: string;
    autoLockNote: string;
    keyLabel: string;
    keyPlaceholder: string;
    showKey: string;
    hideKey: string;
    errEnterKey: string;
    errInvalidKey: string;
    errServerUnavailable: string;
    errMissingEnvVars: string;
    verifyAndEnter: string;
    verifyingBtn: string;
    accessConfirmed: string;
    title: string;
    desc: string;
    lockBtn: string;
    protocolLabel: string;
    protocolTabsLabel: string;
    countryScopeLabel: string;
    allCountriesDefault: string;
    configForProtocolLabel: (protocol: string) => string;
    configPlaceholder: (hint: string) => string;
    parsedEndpointPrefix: string;
    endpointNotParsed: string;
    adminNoteLabel: string;
    adminNotePlaceholder: string;
    errEmptyConfig: string;
    saveConfigBtn: string;
    configSavedBtn: string;
    savedListTitle: string;
    countUnit: (count: number) => string;
    savedListEmpty: string;
    editBtn: string;
    confirmDeleteBtn: string;
    cancelDeleteBtn: string;
  };
  errors: {
    loadFailed: string;
    saveFailed: string;
    deleteFailed: string;
    storageUnavailable: string;
    retryBtn: string;
    dismissBtn: string;
  };
  protocols: Record<VpnProtocol, string>;
  countries: Record<VpnCountry, { name: string; region: string }>;
  pingErrors: Record<PingErrorCode, string>;
}

export const TRANSLATIONS: Record<AppLanguage, Translations> = {
  ru: {
    auth: {
      loginTitle: 'Авторизация администратора',
      loginSubtitle:
        'Войдите для доступа к общей серверной базе данных и синхронизации между устройствами в реальном времени.',
      usernameLabel: 'Логин администратора',
      usernamePlaceholder: 'admin',
      passwordLabel: 'Пароль администратора',
      passwordPlaceholder: 'Введите пароль администратора',
      showPassword: 'Показать пароль',
      hidePassword: 'Скрыть пароль',
      loginBtn: 'Войти в панель',
      loggingInBtn: 'Вход и загрузка данных...',
      logoutBtn: 'Выйти',
      errEmptyPassword: 'Введите пароль администратора',
      errInvalidCredentials: 'Неверный логин или пароль администратора',
      errServerError: 'Не удалось связаться с сервером авторизации',
      errMissingEnvVars:
        'На сервере не настроены обязательные секретные переменные окружения (VEXTON_ADMIN_PASSWORD, VEXTON_SECURITY_KEY, VEXTON_SESSION_SECRET).',
      securityNote:
        'Проверка выполняется на сервере, а секретные ключи не хранятся в клиентском коде.',
      checkingSession: 'Проверка серверной сессии...',
    },
    sync: {
      connectedLive: 'Онлайн · Синхронизация',
      reconnecting: 'Переподключение...',
      offline: 'Офлайн',
      devicesOnline: (count) => `Устройств онлайн: ${count}`,
      serverDbLabel: 'Общая БД сервера (SQLite + WebSocket)',
    },
    nav: {
      mainPanel: 'Главная панель',
      createCode: 'Создать VPN-код',
      settings: 'Настройки',
      securityKey: 'Защитный ключ',
      mobileHome: 'Главная',
      mobileAdd: 'Добавить',
      mobileSettings: 'Настройки',
      mobileKey: 'Ключ',
      mainNavLabel: 'Основная навигация',
      mobileNavLabel: 'Мобильная навигация',
      localStorageTitle: 'Общий сервер',
      blockUnlockedNote: 'Защитный блок открыт на текущий сеанс',
      blockLockedNote: 'Доступ закрывается при выходе',
      addButton: 'Добавить',
    },
    screens: {
      dashboard: 'Главная панель',
      create: 'Создание VPN-кода',
      result: 'Результат и конфигурация',
      settings: 'Настройки',
      security_block: 'Настройки / Защитный ключ / Исправление блока',
    },
    toast: {
      copiedTitle: 'Скопировано в буфер обмена',
      copiedDesc: (name) =>
        name
          ? `VPN-конфигурация «${name}» готова к использованию`
          : 'VPN-конфигурация скопирована',
      close: 'Закрыть уведомление',
    },
    dashboard: {
      subtitle:
        'Единая административная панель с общей базой данных сервера и синхронизацией изменений между устройствами в реальном времени.',
      totalCodes: 'Всего кодов',
      withConfig: 'С конфигом',
      templatesCount: 'Шаблонов',
      settingsCardDesc:
        'Выбор языка, архитектура серверов, экспорт базы данных и управление сессией',
      openAction: 'Открыть',
      securityCardDesc:
        'Исправление блока — серверная проверка ключа и реальные конфигурации протоколов',
      statusUnlocked: 'Открыт',
      statusCheck: 'Проверка ключа',
      listTitle: 'Список созданных VPN-кодов',
      listSubtitle: 'Общая серверная база данных · изменения синхронизируются на всех устройствах',
      shownCount: (shown, total) => `Показано ${shown} из ${total}`,
      searchPlaceholder: 'Поиск по названию...',
      searchLabel: 'Поиск по названию кода',
      allProtocols: 'Все протоколы',
      protocolFilterLabel: 'Фильтр по протоколу',
      allCountries: 'Все страны',
      countryFilterLabel: 'Фильтр по стране',
      emptyTitle: 'Созданных VPN-кодов пока нет',
      emptyDesc:
        'Нажмите «Добавить», чтобы пройти пошаговое создание записи: выбрать протокол, страну, название и остаток времени.',
      createFirstBtn: 'Создать первый VPN-код',
      noFilterMatch: 'По выбранным фильтрам записи не найдены',
      resetFilters: 'Сбросить фильтры',
      pingUnreachableShort: 'Недоступен',
      pingMs: (ms) => `${ms} мс`,
      configAttached: 'Конфигурация привязана',
      configMissing: 'Ожидает конфигурацию',
      fallbackCodeName: 'VPN-код',
      openBtn: 'Открыть',
      editBtn: 'Изменить',
      copyBtn: 'Копировать',
      copiedBtn: 'Скопировано',
      confirmDeleteBtn: 'Удалить?',
      cancelBtn: 'Отмена',
    },
    wizard: {
      backToHome: 'На главную',
      back: 'Назад',
      stepOf: (step) => `Шаг ${step} из 5`,
      title: 'Пошаговое создание VPN-кода',
      subtitle:
        'Настройка параметров записи, автоматическая привязка конфигурации и мгновенная синхронизация',
      stepsAria: 'Этапы создания',
      steps: ['Протокол', 'Страна', 'Название', 'Срок', 'Создание'],
      step1Title: '1. Выбор протокола',
      step1Desc: 'Выберите транспортный протокол для новой VPN-записи.',
      configReadyBadge: 'Конфиг задан',
      configNotSetBadge: 'Не задан',
      step2Title: '2. Выбор страны',
      step2Desc: 'Укажите локацию сервера для привязки конфигурации.',
      step3Title: '3. Ввод названия кода',
      step3Desc:
        'Задайте понятное имя для идентификации клиента или устройства в списке.',
      codeNameLabel: 'Название VPN-кода',
      codeNamePlaceholder: 'Например: Client-NL-01',
      codeNameErrorEmpty: 'Введите название VPN-кода для продолжения',
      quickTemplatePrefix: 'Быстрый шаблон имени:',
      step4Title: '4. Ввод остатка времени',
      step4Desc: 'Укажите срок действия доступа для расчёта обратного отсчёта.',
      amountLabel: 'Количество',
      unitLabel: 'Единица времени',
      unitMinutes: 'Минуты',
      unitHours: 'Часы',
      unitDays: 'Дни',
      durationErrorMin: 'Укажите корректное время (минимум 1)',
      preset12h: '12 часов',
      preset7d: '7 дней',
      preset30d: '30 дней',
      preset90d: '90 дней',
      selectedDurationPrefix: 'Установленный остаток времени:',
      step5Title: '5. Создание записи',
      step5Desc:
        'Проверьте параметры. Настоящий VPN-код автоматически загружается из конфигурации сервера в разделе «Исправление блока».',
      summaryName: 'Название кода',
      summaryProtocol: 'Протокол',
      summaryCountry: 'Страна',
      summaryDuration: 'Остаток времени',
      templateFound: (scope) =>
        `Подключена реальная конфигурация сервера (${scope})`,
      boundConfigLabel: 'Конфигурация сервера для выдачи VPN-кода',
      base64ToggleTitle: 'Преобразовать код в Base64',
      base64ToggleDesc:
        'При включении готовая конфигурация VLESS кодируется в UTF-8 Base64 для VPN-подписок. При выключении используется обычный формат VLESS.',
      base64ToggleOn: 'Вкл · Base64 (VPN-подписка)',
      base64ToggleOff: 'Выкл · Обычный формат VLESS',
      base64NonVlessNote:
        'Настройка применяется к VLESS-конфигурациям; выбранный протокол сохраняется в обычном формате.',
      templateMissingTitle: (protocol, country) =>
        `Для ${protocol} (${country}) не найдена конфигурация сервера в «Исправление блока»`,
      templateMissingDesc:
        'Панель не создаёт фиктивные VPN-коды. Добавьте реальную конфигурацию сервера в разделе «Исправление блока» или создайте запись в ожидании.',
      blockFixBtn: 'Исправление блока',
      detectedEndpoint: 'Узел сервера для проверки пинга:',
      noEndpointDetected:
        'Узел сервера в конфигурации не найден — фиктивный пинг не создаётся.',
      creatingTitle: 'Сохранение на сервере...',
      creatingSubtitle: 'Синхронизация параметров и конфигурации между устройствами',
      cancel: 'Отмена',
      next: 'Далее',
      createRecord: 'Создать запись',
    },
    result: {
      backToHome: 'На главную',
      createdAt: (d) => `Создан: ${d}`,
      editRecordBtn: 'Редактировать',
      editTitle: 'Редактирование VPN-записи',
      editNameLabel: 'Название кода',
      editNamePlaceholder: 'Введите название VPN-кода',
      editNameError: 'Название VPN-кода не может быть пустым',
      editCountryLabel: 'Страна',
      editDurationAmountLabel: 'Остаток времени (значение)',
      editDurationUnitLabel: 'Единица времени',
      editConfigLabel: 'VPN-код (конфигурация)',
      editConfigPlaceholder: 'vless://... или другая конфигурация сервера',
      saveRecordBtn: 'Сохранить',
      savingRecordBtn: 'Сохранение...',
      savedRecordNotice: 'Изменения сохранены и синхронизированы',
      cancelEditBtn: 'Отмена',
      realServerConfigTitle: 'VPN-код из конфигурации сервера',
      sourceBlockFix: 'Источник: конфигурация сервера',
      sourceBase64Badge: 'Base64 · VPN-подписка',
      configReadyTitle: 'VPN-код сформирован и готов к копированию',
      configReadyDesc:
        'Полный VPN-код скрыт на экране. Нажмите «Копировать» или «Копировать и выйти», чтобы скопировать его в буфер обмена.',
      noConfigTitle: 'Конфигурация сервера ещё не добавлена',
      noConfigDesc:
        'Панель не генерирует вымышленные адреса, UUID или рабочие коды. Сохраните реальную конфигурацию в разделе «Настройки → Защитный ключ → Исправление блока».',
      syncFromBlockBtn: 'Получить из «Исправление блока»',
      goToBlockFix: 'Открыть Защитный ключ → Исправление блока',
      pingCheckTitle: 'Проверка реального пинга',
      pingCheckingDesc: 'Выполняется TCP-подключение к узлу сервера...',
      pingNodePrefix: (hp) => `Узел: ${hp}`,
      pingNodeMissing: 'Адрес сервера и порт в конфигурации не определены',
      checkingPing: 'Проверка...',
      checkPingBtn: 'Проверить пинг',
      serverReachable: (ms) => `Сервер доступен · Пинг: ${ms} мс`,
      serverUnreachable: 'Сервер недоступен',
      copyBtn: 'Копировать',
      copiedBtn: 'Скопировано',
      copyAndExitBtn: 'Копировать и выйти',
    },
    settings: {
      backToHome: 'На главную',
      title: 'Настройки',
      subtitle:
        'Язык интерфейса, защитный ключ, серверная база данных и синхронизация устройств',
      languageTitle: 'Язык интерфейса',
      languageDesc:
        'Переключение языка переводит меню, кнопки, формы и уведомления и сохраняется автоматически.',
      languageSaved: 'Язык сохранён',
      breadcrumbSettings: 'Настройки',
      breadcrumbKey: 'Защитный ключ',
      breadcrumbBlockFix: 'Исправление блока',
      securitySectionTitle: 'Защитный ключ и Исправление блока',
      securitySectionDesc:
        'Проверка доступа на сервере и управление настоящими конфигурациями для Hysteria, ShadowSocks, VLESS, VMess, Trojan.',
      savedConfigsMeta: (count) => `Сохранено конфигураций: ${count}`,
      statusLabel: 'Статус:',
      statusUnlocked: 'Доступ открыт',
      statusNeedCheck: 'Требуется ввод ключа при каждом входе',
      openSecurityKeyBtn: 'Открыть Защитный ключ',
      archTitle: 'Архитектура подключения серверов',
      archDesc:
        'Параметры адаптера для синхронизации и подключения внешних VPN-серверов по API. Фиктивные подключения не создаются.',
      adapterModeLabel: 'Режим адаптера',
      adapterModeLocal: 'Серверная БД SQLite + TCP-пинг',
      adapterModeRest: 'Серверная БД + синхронизация WebSocket / REST API',
      authHeaderLabel: 'Заголовок авторизации API',
      apiBaseUrlLabel: 'Базовый URL внешнего сервера (опционально)',
      syncPathLabel: 'Путь синхронизации',
      autoPingCheckbox:
        'Автоматически проверять реальный пинг после создания записи (если в конфигурации указан адрес сервера)',
      base64ToggleTitle: 'Преобразовать код в Base64',
      base64ToggleDesc:
        'Кодировать создаваемые и обновляемые VLESS-конфигурации в формат Base64 (без двойного кодирования)',
      saveSettingsBtn: 'Сохранить настройки',
      savedBtn: 'Сохранено',
      localStorageTitle: 'Общая серверная база данных',
      localStorageDesc:
        'Данные хранятся на сервере в общей базе SQLite и синхронизируются между устройствами по WebSocket без использования Firebase.',
      exportJsonBtn: 'Экспорт JSON',
      confirmClearBtn: (count) => `Подтвердить очистку (${count})`,
      cancelBtn: 'Отмена',
      clearAllCodesBtn: 'Удалить все созданные коды',
      logoutAdminBtn: 'Выйти из аккаунта администратора',
    },
    securityBlock: {
      backToSettings: 'Назад в Настройки',
      verifyTitle: 'Проверка защитного ключа',
      verifyDesc:
        'Для входа в раздел «Исправление блока» введите защитный ключ. Проверка выполняется на сервере.',
      autoLockNote:
        'При нажатии «Назад», закрытии раздела или обновлении страницы доступ автоматически блокируется.',
      keyLabel: 'Защитный ключ',
      keyPlaceholder: 'Введите защитный ключ',
      showKey: 'Показать ключ',
      hideKey: 'Скрыть ключ',
      errEnterKey: 'Введите защитный ключ',
      errInvalidKey: 'Неверный защитный ключ',
      errServerUnavailable: 'Не удалось выполнить проверку ключа на сервере',
      errMissingEnvVars:
        'На сервере не настроены обязательные секретные переменные окружения.',
      verifyAndEnter: 'Проверить и войти',
      verifyingBtn: 'Проверка ключа...',
      accessConfirmed: 'Доступ подтверждён сервером',
      title: 'Исправление блока',
      desc: 'Добавьте настоящие конфигурации серверов для каждого протокола. Они сохраняются на сервере и используются при создании VPN-кодов.',
      lockBtn: 'Закрыть доступ',
      protocolLabel: 'Протокол',
      protocolTabsLabel: 'Выбор протокола для конфигурации',
      countryScopeLabel: 'Привязка к стране',
      allCountriesDefault: 'Все страны (по умолчанию)',
      configForProtocolLabel: (p) => `Настоящая конфигурация сервера для ${p}`,
      configPlaceholder: (hint) => `${hint}`,
      parsedEndpointPrefix: 'Автоопределение узла для пинга:',
      endpointNotParsed: 'Адрес и порт из конфигурации не распознаны',
      adminNoteLabel: 'Заметка администратора (необязательно)',
      adminNotePlaceholder: 'Например: Основной узел NL',
      errEmptyConfig:
        'Укажите настоящую конфигурацию сервера перед сохранением',
      saveConfigBtn: 'Сохранить конфигурацию',
      configSavedBtn: 'Конфигурация сохранена',
      savedListTitle: 'Сохранённые конфигурации серверов',
      countUnit: (c) => `${c} шт.`,
      savedListEmpty:
        'Сохранённых конфигураций пока нет. Выберите протокол выше и сохраните реальную конфигурацию сервера.',
      editBtn: 'Редактировать',
      confirmDeleteBtn: 'Удалить?',
      cancelDeleteBtn: 'Отмена',
    },
    errors: {
      loadFailed: 'Не удалось загрузить сохранённые данные с сервера. Проверьте соединение и повторите попытку.',
      saveFailed: 'Сервер не подтвердил сохранение. Данные не потеряны — повторите попытку.',
      deleteFailed: 'Сервер не подтвердил удаление. Запись осталась в базе.',
      storageUnavailable: 'Серверное постоянное хранилище временно недоступно.',
      retryBtn: 'Повторить',
      dismissBtn: 'Скрыть',
    },
    protocols: {
      Hysteria: 'Быстрый транспорт на базе QUIC',
      ShadowSocks: 'Лёгкий шифрованный SOCKS5-туннель',
      VLESS: 'Современный Xray-протокол без лишнего оверхеда',
      VMess: 'Конфигурация V2Ray с JSON-параметрами',
      Trojan: 'Маскировка трафика под HTTPS/TLS',
    },
    countries: {
      Туркменистан: { name: 'Туркменистан', region: 'Центральная Азия' },
      Россия: { name: 'Россия', region: 'Восточная Европа' },
      Нидерланды: { name: 'Нидерланды', region: 'Западная Европа' },
      Германия: { name: 'Германия', region: 'Центральная Европа' },
      Британия: { name: 'Британия', region: 'Северная Европа' },
      Швеция: { name: 'Швеция', region: 'Скандинавия' },
    },
    pingErrors: {
      NO_ENDPOINT: 'В конфигурации сервера не найден адрес и порт',
      TIMEOUT: 'Превышен таймаут ожидания (4 с)',
      CONNREFUSED: 'Сервер отклонил подключение (порт закрыт)',
      NOTFOUND: 'Доменное имя сервера не найдено (DNS)',
      UNREACHABLE: 'Сервер недоступен по сети',
      NETWORK: 'Сервер недоступен по сети',
      INVALID_RESPONSE: 'Ошибка проверки доступности сервера',
      LOCAL_SERVER_ERROR:
        'Не удалось выполнить сетевую проверку через локальный сервер',
    },
  },

  en: {
    auth: {
      loginTitle: 'Administrator Sign In',
      loginSubtitle:
        'Sign in to access the shared server database and real-time multi-device synchronization.',
      usernameLabel: 'Admin Username',
      usernamePlaceholder: 'admin',
      passwordLabel: 'Admin Password',
      passwordPlaceholder: 'Enter administrator password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      loginBtn: 'Sign In',
      loggingInBtn: 'Signing in & loading...',
      logoutBtn: 'Sign Out',
      errEmptyPassword: 'Enter administrator password',
      errInvalidCredentials: 'Invalid administrator username or password',
      errServerError: 'Could not reach the authentication server',
      errMissingEnvVars:
        'Required server secret environment variables are missing (VEXTON_ADMIN_PASSWORD, VEXTON_SECURITY_KEY, VEXTON_SESSION_SECRET).',
      securityNote:
        'Authentication is verified on the server; secret keys are never stored in client code.',
      checkingSession: 'Verifying server session...',
    },
    sync: {
      connectedLive: 'Live Sync',
      reconnecting: 'Reconnecting...',
      offline: 'Offline',
      devicesOnline: (count) => `Devices online: ${count}`,
      serverDbLabel: 'Shared Server DB (SQLite + WebSocket)',
    },
    nav: {
      mainPanel: 'Dashboard',
      createCode: 'Create VPN Code',
      settings: 'Settings',
      securityKey: 'Security Key',
      mobileHome: 'Home',
      mobileAdd: 'Add',
      mobileSettings: 'Settings',
      mobileKey: 'Key',
      mainNavLabel: 'Primary navigation',
      mobileNavLabel: 'Mobile navigation',
      localStorageTitle: 'Shared Server',
      blockUnlockedNote: 'Protected block unlocked for current view',
      blockLockedNote: 'Access locks automatically on exit',
      addButton: 'Add',
    },
    screens: {
      dashboard: 'Dashboard',
      create: 'Create VPN Code',
      result: 'Result & Configuration',
      settings: 'Settings',
      security_block: 'Settings / Security Key / Block Fix',
    },
    toast: {
      copiedTitle: 'Copied to clipboard',
      copiedDesc: (name) =>
        name
          ? `VPN configuration "${name}" is ready to use`
          : 'VPN configuration copied',
      close: 'Dismiss notification',
    },
    dashboard: {
      subtitle:
        'Unified admin panel backed by a shared server database with real-time synchronization across all connected devices.',
      totalCodes: 'Total Codes',
      withConfig: 'Configured',
      templatesCount: 'Templates',
      settingsCardDesc:
        'Language switcher, server architecture, database export, and session controls',
      openAction: 'Open',
      securityCardDesc:
        'Block Fix — server key verification and real configurations for each protocol',
      statusUnlocked: 'Unlocked',
      statusCheck: 'Key Check',
      listTitle: 'Created VPN Codes',
      listSubtitle: 'Shared server database · changes sync automatically across all devices',
      shownCount: (shown, total) => `Showing ${shown} of ${total}`,
      searchPlaceholder: 'Search by code name...',
      searchLabel: 'Search by code name',
      allProtocols: 'All Protocols',
      protocolFilterLabel: 'Filter by protocol',
      allCountries: 'All Countries',
      countryFilterLabel: 'Filter by country',
      emptyTitle: 'No VPN codes created yet',
      emptyDesc:
        'Click "Add" to start the step-by-step creation flow: choose protocol, country, name, and remaining time.',
      createFirstBtn: 'Create First VPN Code',
      noFilterMatch: 'No records match the selected filters',
      resetFilters: 'Reset filters',
      pingUnreachableShort: 'Unreachable',
      pingMs: (ms) => `${ms} ms`,
      configAttached: 'Configuration bound',
      configMissing: 'Awaiting configuration',
      fallbackCodeName: 'VPN Code',
      openBtn: 'Open',
      editBtn: 'Edit',
      copyBtn: 'Copy',
      copiedBtn: 'Copied',
      confirmDeleteBtn: 'Delete?',
      cancelBtn: 'Cancel',
    },
    wizard: {
      backToHome: 'Back to Home',
      back: 'Back',
      stepOf: (step) => `Step ${step} of 5`,
      title: 'Step-by-Step VPN Code Creation',
      subtitle:
        'Configure parameters, bind a real server configuration, and sync immediately across devices',
      stepsAria: 'Creation steps',
      steps: ['Protocol', 'Country', 'Name', 'Duration', 'Create'],
      step1Title: '1. Select Protocol',
      step1Desc: 'Choose the transport protocol for the new VPN record.',
      configReadyBadge: 'Config ready',
      configNotSetBadge: 'Not set',
      step2Title: '2. Select Country',
      step2Desc: 'Select the server location to bind the configuration.',
      step3Title: '3. Enter Code Name',
      step3Desc:
        'Provide a clear label to identify the client or device in your list.',
      codeNameLabel: 'VPN Code Name',
      codeNamePlaceholder: 'Example: Client-NL-01',
      codeNameErrorEmpty: 'Enter a VPN code name to continue',
      quickTemplatePrefix: 'Quick name preset:',
      step4Title: '4. Enter Remaining Time',
      step4Desc: 'Specify the access duration for the remaining countdown.',
      amountLabel: 'Amount',
      unitLabel: 'Time unit',
      unitMinutes: 'Minutes',
      unitHours: 'Hours',
      unitDays: 'Days',
      durationErrorMin: 'Enter a valid duration (minimum 1)',
      preset12h: '12 hours',
      preset7d: '7 days',
      preset30d: '30 days',
      preset90d: '90 days',
      selectedDurationPrefix: 'Selected remaining time:',
      step5Title: '5. Create Record',
      step5Desc:
        'Review parameters. The real VPN code is automatically pulled from the server configuration in Block Fix.',
      summaryName: 'Code Name',
      summaryProtocol: 'Protocol',
      summaryCountry: 'Country',
      summaryDuration: 'Remaining Time',
      templateFound: (scope) =>
        `Real server configuration connected (${scope})`,
      boundConfigLabel: 'Server configuration for VPN code output',
      base64ToggleTitle: 'Convert code to Base64',
      base64ToggleDesc:
        'When enabled, the ready VLESS configuration is encoded to UTF-8 Base64 for VPN subscriptions. When disabled, standard VLESS format is used.',
      base64ToggleOn: 'On · Base64 (VPN subscription)',
      base64ToggleOff: 'Off · Standard VLESS format',
      base64NonVlessNote:
        'Applies to VLESS configurations; the selected protocol keeps its native format.',
      templateMissingTitle: (protocol, country) =>
        `No server configuration saved in Block Fix for ${protocol} (${country})`,
      templateMissingDesc:
        'This panel never generates fake VPN codes. Add a real server configuration in Block Fix or create the record as pending.',
      blockFixBtn: 'Block Fix',
      detectedEndpoint: 'Server endpoint for live ping check:',
      noEndpointDetected:
        'Server endpoint not detected in config — ping latency will not be fabricated.',
      creatingTitle: 'Saving to shared server...',
      creatingSubtitle: 'Syncing parameters and server configuration across all devices',
      cancel: 'Cancel',
      next: 'Next',
      createRecord: 'Create Record',
    },
    result: {
      backToHome: 'Back to Home',
      createdAt: (d) => `Created: ${d}`,
      editRecordBtn: 'Edit',
      editTitle: 'Edit VPN Record',
      editNameLabel: 'Code Name',
      editNamePlaceholder: 'Enter VPN code name',
      editNameError: 'VPN code name cannot be empty',
      editCountryLabel: 'Country',
      editDurationAmountLabel: 'Remaining Time (amount)',
      editDurationUnitLabel: 'Time Unit',
      editConfigLabel: 'VPN Code (configuration)',
      editConfigPlaceholder: 'vless://... or another real server config',
      saveRecordBtn: 'Save',
      savingRecordBtn: 'Saving...',
      savedRecordNotice: 'Changes saved and synced across devices',
      cancelEditBtn: 'Cancel',
      realServerConfigTitle: 'VPN Code from Server Configuration',
      sourceBlockFix: 'Source: Server Configuration',
      sourceBase64Badge: 'Base64 · VPN subscription',
      configReadyTitle: 'VPN code generated and ready to copy',
      configReadyDesc:
        'The full VPN code is hidden on screen. Use Copy or Copy & Exit below to copy it to your clipboard.',
      noConfigTitle: 'Server configuration not added yet',
      noConfigDesc:
        'This panel never invents server addresses, UUIDs, or working codes. Add a real server configuration in Settings → Security Key → Block Fix.',
      syncFromBlockBtn: 'Load from Block Fix',
      goToBlockFix: 'Open Security Key → Block Fix',
      pingCheckTitle: 'Live Ping Check',
      pingCheckingDesc: 'Running live TCP handshake to server node...',
      pingNodePrefix: (hp) => `Endpoint: ${hp}`,
      pingNodeMissing: 'Server host and port are not defined in config',
      checkingPing: 'Checking...',
      checkPingBtn: 'Check Ping',
      serverReachable: (ms) => `Server reachable · Ping: ${ms} ms`,
      serverUnreachable: 'Server unreachable',
      copyBtn: 'Copy',
      copiedBtn: 'Copied',
      copyAndExitBtn: 'Copy & Exit',
    },
    settings: {
      backToHome: 'Back to Home',
      title: 'Settings',
      subtitle:
        'Interface language, security key access, shared server database, and device sync',
      languageTitle: 'Interface Language',
      languageDesc:
        'Switching language translates menus, buttons, forms, and notifications immediately and persists locally.',
      languageSaved: 'Language saved',
      breadcrumbSettings: 'Settings',
      breadcrumbKey: 'Security Key',
      breadcrumbBlockFix: 'Block Fix',
      securitySectionTitle: 'Security Key & Block Fix',
      securitySectionDesc:
        'Server-verified access gate and real server configuration manager for Hysteria, ShadowSocks, VLESS, VMess, and Trojan.',
      savedConfigsMeta: (count) => `Saved configurations: ${count}`,
      statusLabel: 'Status:',
      statusUnlocked: 'Unlocked',
      statusNeedCheck: 'Key required on every visit',
      openSecurityKeyBtn: 'Open Security Key',
      archTitle: 'Server Connection Architecture',
      archDesc:
        'Adapter parameters prepared for syncing and connecting external VPN servers via API. No fake connections are created.',
      adapterModeLabel: 'Adapter Mode',
      adapterModeLocal: 'Server SQLite DB + live TCP ping',
      adapterModeRest: 'Server DB + WebSocket / REST API sync',
      authHeaderLabel: 'API Auth Header',
      apiBaseUrlLabel: 'External Control Server Base URL (optional)',
      syncPathLabel: 'Sync Endpoint Path',
      autoPingCheckbox:
        'Automatically run live ping check after creating a record (when server address is present)',
      base64ToggleTitle: 'Convert code to Base64',
      base64ToggleDesc:
        'Encode created and updated VLESS configurations into Base64 format (prevents double encoding)',
      saveSettingsBtn: 'Save Settings',
      savedBtn: 'Saved',
      localStorageTitle: 'Shared Server Database',
      localStorageDesc:
        'Records are persisted on the server in a shared SQLite database and synchronized in real time via WebSockets without Firebase.',
      exportJsonBtn: 'Export JSON',
      confirmClearBtn: (count) => `Confirm Clear (${count})`,
      cancelBtn: 'Cancel',
      clearAllCodesBtn: 'Delete All Created Codes',
      logoutAdminBtn: 'Sign Out of Admin Panel',
    },
    securityBlock: {
      backToSettings: 'Back to Settings',
      verifyTitle: 'Security Key Verification',
      verifyDesc:
        'Enter the security key to open the Block Fix section. Verification runs on the server.',
      autoLockNote:
        'Access closes automatically when clicking Back, leaving this section, or reloading the page.',
      keyLabel: 'Security Key',
      keyPlaceholder: 'Enter security key',
      showKey: 'Show key',
      hideKey: 'Hide key',
      errEnterKey: 'Enter security key',
      errInvalidKey: 'Invalid security key',
      errServerUnavailable: 'Could not verify key with the server',
      errMissingEnvVars: 'Required server secret environment variables are missing.',
      verifyAndEnter: 'Verify & Enter',
      verifyingBtn: 'Verifying key...',
      accessConfirmed: 'Access verified by server',
      title: 'Block Fix',
      desc: 'Add real server configurations for each protocol. They are saved on the server and used when creating VPN codes.',
      lockBtn: 'Lock Access',
      protocolLabel: 'Protocol',
      protocolTabsLabel: 'Select protocol for configuration',
      countryScopeLabel: 'Country Scope',
      allCountriesDefault: 'All countries (default)',
      configForProtocolLabel: (p) => `Real server configuration for ${p}`,
      configPlaceholder: (hint) => `${hint}`,
      parsedEndpointPrefix: 'Auto-detected ping node:',
      endpointNotParsed: 'Server address and port not detected',
      adminNoteLabel: 'Admin Note (optional)',
      adminNotePlaceholder: 'Example: Primary NL node',
      errEmptyConfig: 'Enter a real server configuration before saving',
      saveConfigBtn: 'Save Configuration',
      configSavedBtn: 'Configuration Saved',
      savedListTitle: 'Saved Server Configurations',
      countUnit: (c) => `${c} items`,
      savedListEmpty:
        'No saved configurations yet. Select a protocol above and save a real server configuration.',
      editBtn: 'Edit',
      confirmDeleteBtn: 'Delete?',
      cancelDeleteBtn: 'Cancel',
    },
    errors: {
      loadFailed: 'Could not load saved records from the server. Check your connection and try again.',
      saveFailed: 'The server did not confirm saving. Please try again.',
      deleteFailed: 'The server did not confirm deletion. The record remains stored.',
      storageUnavailable: 'Persistent server storage is currently unavailable.',
      retryBtn: 'Retry',
      dismissBtn: 'Dismiss',
    },
    protocols: {
      Hysteria: 'Fast QUIC-based transport protocol',
      ShadowSocks: 'Lightweight encrypted SOCKS5 tunnel',
      VLESS: 'Modern Xray protocol with minimal overhead',
      VMess: 'V2Ray configuration with JSON parameters',
      Trojan: 'Traffic obfuscation over HTTPS/TLS',
    },
    countries: {
      Туркменистан: { name: 'Turkmenistan', region: 'Central Asia' },
      Россия: { name: 'Russia', region: 'Eastern Europe' },
      Нидерланды: { name: 'Netherlands', region: 'Western Europe' },
      Германия: { name: 'Germany', region: 'Central Europe' },
      Британия: { name: 'Britain', region: 'Northern Europe' },
      Швеция: { name: 'Sweden', region: 'Scandinavia' },
    },
    pingErrors: {
      NO_ENDPOINT: 'No server address and port found in configuration',
      TIMEOUT: 'Connection timed out (4 s)',
      CONNREFUSED: 'Connection refused by server (port closed)',
      NOTFOUND: 'Server hostname not found (DNS)',
      UNREACHABLE: 'Server network unreachable',
      NETWORK: 'Server unreachable over network',
      INVALID_RESPONSE: 'Server availability check failed',
      LOCAL_SERVER_ERROR: 'Could not run network probe via local server',
    },
  },

  tk: {
    auth: {
      loginTitle: 'Administrator girişi',
      loginSubtitle:
        'Umumy serwer maglumat bazasyna we enjamlaryň arasynda hakyky wagtda sinhronizasiýa girmek üçin ulgama giriň.',
      usernameLabel: 'Administrator ady',
      usernamePlaceholder: 'admin',
      passwordLabel: 'Administrator paroly',
      passwordPlaceholder: 'Administrator parolyny giriziň',
      showPassword: 'Paroly görkezmek',
      hidePassword: 'Paroly gizlemek',
      loginBtn: 'Panele girmek',
      loggingInBtn: 'Girilýär we maglumatlar ýüklenýär...',
      logoutBtn: 'Çykmak',
      errEmptyPassword: 'Administrator parolyny giriziň',
      errInvalidCredentials: 'Nädogry administrator ady ýa-da parol',
      errServerError: 'Awtorizasiýa serweri bilen baglanyşyp bolmady',
      errMissingEnvVars:
        'Serwerde hökmany gizlin gurşaw üýtgeýjileri sazlanmandyr (VEXTON_ADMIN_PASSWORD, VEXTON_SECURITY_KEY, VEXTON_SESSION_SECRET).',
      securityNote:
        'Barlag serwerde geçirilýär we gizlin açarlar müşderi kodunda saklanmaýar.',
      checkingSession: 'Serwer sessiýasy barlanýar...',
    },
    sync: {
      connectedLive: 'Onlaýn · Sinhronizasiýa',
      reconnecting: 'Gaýtadan birikdirilýär...',
      offline: 'Oflaýn',
      devicesOnline: (count) => `Onlaýn enjamlar: ${count}`,
      serverDbLabel: 'Umumy serwer bazasy (SQLite + WebSocket)',
    },
    nav: {
      mainPanel: 'Baş panel',
      createCode: 'VPN kod döretmek',
      settings: 'Sazlamalar',
      securityKey: 'Gorag açary',
      mobileHome: 'Baş sahypa',
      mobileAdd: 'Goşmak',
      mobileSettings: 'Sazlama',
      mobileKey: 'Açar',
      mainNavLabel: 'Esasy nawigasiýa',
      mobileNavLabel: 'Mobil nawigasiýa',
      localStorageTitle: 'Umumy serwer',
      blockUnlockedNote: 'Gorag blogy häzirki sessiýa üçin açyk',
      blockLockedNote: 'Çykylanda giriş awtomatik ýapylýar',
      addButton: 'Goşmak',
    },
    screens: {
      dashboard: 'Baş panel',
      create: 'VPN kod döretmek',
      result: 'Netije we konfigurasiýa',
      settings: 'Sazlamalar',
      security_block: 'Sazlamalar / Gorag açary / Blogy düzetmek',
    },
    toast: {
      copiedTitle: 'Alşyp-çalyş buferine göçürildi',
      copiedDesc: (name) =>
        name
          ? `«${name}» VPN konfigurasiýasy ulanmaga taýýar`
          : 'VPN konfigurasiýasy göçürildi',
      close: 'Habarnamany ýapmak',
    },
    dashboard: {
      subtitle:
        'Umumy serwer maglumat bazasy we ähli enjamlarda hakyky wagtda sinhronizasiýa bilen bitewi dolandyryş paneli.',
      totalCodes: 'Jemi kod',
      withConfig: 'Konfigli',
      templatesCount: 'Şablon',
      settingsCardDesc:
        'Dil saýlamak, serwer arhitekturasy, baza eksporty we sessiýa dolandyryşy',
      openAction: 'Açmak',
      securityCardDesc:
        'Blogy düzetmek — serwerde açar barlagy we her protokol üçin hakyky konfigurasiýalar',
      statusUnlocked: 'Açyk',
      statusCheck: 'Açar barlagy',
      listTitle: 'Döredilen VPN kodlarynyň sanawy',
      listSubtitle: 'Umumy serwer bazasy · üýtgetmeler ähli enjamlarda awtomatik täzelenýär',
      shownCount: (shown, total) => `${total} sanydan ${shown} görkezilýär`,
      searchPlaceholder: 'Ady boýunça gözleg...',
      searchLabel: 'Kod ady boýunça gözleg',
      allProtocols: 'Ähli protokollar',
      protocolFilterLabel: 'Protokol boýunça süzgüç',
      allCountries: 'Ähli ýurtlar',
      countryFilterLabel: 'Ýurt boýunça süzgüç',
      emptyTitle: 'Entek döredilen VPN kody ýok',
      emptyDesc:
        'Ädimme-ädim ýazgy döretmek üçin «Goşmak» düwmesine basyň: protokol, ýurt, at we galan wagty saýlaň.',
      createFirstBtn: 'Ilkinji VPN kody döretmek',
      noFilterMatch: 'Saýlanan süzgüçler boýunça ýazgy tapylmady',
      resetFilters: 'Süzgüçleri arassalamak',
      pingUnreachableShort: 'Elýeterli däl',
      pingMs: (ms) => `${ms} ms`,
      configAttached: 'Konfigurasiýa birikdirilen',
      configMissing: 'Konfigurasiýa garaşylýar',
      fallbackCodeName: 'VPN kody',
      openBtn: 'Açmak',
      editBtn: 'Üýtgetmek',
      copyBtn: 'Göçürmek',
      copiedBtn: 'Göçürildi',
      confirmDeleteBtn: 'Pozmalymy?',
      cancelBtn: 'Ýatyrmak',
    },
    wizard: {
      backToHome: 'Baş sahypa',
      back: 'Yza',
      stepOf: (step) => `Ädim ${step} / 5`,
      title: 'Ädimme-ädim VPN kody döretmek',
      subtitle:
        'Ýazgy sazlamalary, hakyky serwer konfigurasiýasy we dessine sinhronizasiýa',
      stepsAria: 'Döretmek ädimleri',
      steps: ['Protokol', 'Ýurt', 'Ady', 'Möhlet', 'Döretmek'],
      step1Title: '1. Protokoly saýlamak',
      step1Desc: 'Täze VPN ýazgysy üçin transport protokolyny saýlaň.',
      configReadyBadge: 'Konfig bar',
      configNotSetBadge: 'Ýok',
      step2Title: '2. Ýurdy saýlamak',
      step2Desc: 'Konfigurasiýany birikdirmek üçin serwer ýerleşýän ýurdy saýlaň.',
      step3Title: '3. Koduň adyny girizmek',
      step3Desc:
        'Sanawda müşderini ýa-da enjamy tanamak üçin düşnükli at giriziň.',
      codeNameLabel: 'VPN kodynyň ady',
      codeNamePlaceholder: 'Mysal: Client-NL-01',
      codeNameErrorEmpty: 'Dowam etmek üçin VPN kodynyň adyny giriziň',
      quickTemplatePrefix: 'Çalt at şablony:',
      step4Title: '4. Galan wagty girizmek',
      step4Desc: 'Ters hasaplama üçin ygtyýarlyk möhletini görkeziň.',
      amountLabel: 'Mukdary',
      unitLabel: 'Wagt birligi',
      unitMinutes: 'Minut',
      unitHours: 'Sagat',
      unitDays: 'Gün',
      durationErrorMin: 'Dogry wagty görkeziň (iň az 1)',
      preset12h: '12 sagat',
      preset7d: '7 gün',
      preset30d: '30 gün',
      preset90d: '90 gün',
      selectedDurationPrefix: 'Bellenen galan wagt:',
      step5Title: '5. Ýazgyny döretmek',
      step5Desc:
        'Maglumatlary barlaň. Hakyky VPN kody «Blogy düzetmek» bölümindäki serwer konfigurasiýasyndan awtomatik alynýar.',
      summaryName: 'Kodyň ady',
      summaryProtocol: 'Protokol',
      summaryCountry: 'Ýurt',
      summaryDuration: 'Galan wagt',
      templateFound: (scope) =>
        `Hakyky serwer konfigurasiýasy birikdirildi (${scope})`,
      boundConfigLabel: 'VPN kody çykarmak üçin serwer konfigurasiýasy',
      base64ToggleTitle: 'Kody Base64 görnüşine öwürmek',
      base64ToggleDesc:
        'Açyk bolanda taýýar VLESS konfigurasiýasy VPN abunalygy üçin UTF-8 Base64 görnüşine öwrülýär. Öçük bolanda adaty VLESS formaty ulanylýar.',
      base64ToggleOn: 'Açyk · Base64 (VPN abunalygy)',
      base64ToggleOff: 'Öçük · Adaty VLESS formaty',
      base64NonVlessNote:
        'Bu sazlama VLESS konfigurasiýalaryna degişlidir; saýlanan protokol öz formatynda saklanýar.',
      templateMissingTitle: (protocol, country) =>
        `${protocol} (${country}) üçin «Blogy düzetmek» bölüminde serwer konfigurasiýasy tapylmady`,
      templateMissingDesc:
        'Panel toslama VPN kodlaryny döretmeýär. «Blogy düzetmek» bölüminde hakyky serwer konfigurasiýasyny goşuň ýa-da garaşýan ýazgyny dörediň.',
      blockFixBtn: 'Blogy düzetmek',
      detectedEndpoint: 'Ping barlagy üçin serwer düwüni:',
      noEndpointDetected:
        'Konfigurasiýada serwer düwüni tapylmady — toslama ping döredilmeýär.',
      creatingTitle: 'Serwerde saklanýar...',
      creatingSubtitle: 'Ýazgy sazlamalary we konfigurasiýa ähli enjamlara ugradylýar',
      cancel: 'Ýatyrmak',
      next: 'Indiki',
      createRecord: 'Ýazgyny döretmek',
    },
    result: {
      backToHome: 'Baş sahypa',
      createdAt: (d) => `Döredilen wagty: ${d}`,
      editRecordBtn: 'Üýtgetmek',
      editTitle: 'VPN ýazgysyny üýtgetmek',
      editNameLabel: 'Koduň ady',
      editNamePlaceholder: 'VPN kodynyň adyny giriziň',
      editNameError: 'VPN kodynyň ady boş bolup bilmez',
      editCountryLabel: 'Ýurt',
      editDurationAmountLabel: 'Galan wagt (mukdary)',
      editDurationUnitLabel: 'Wagt birligi',
      editConfigLabel: 'VPN kody (konfigurasiýa)',
      editConfigPlaceholder: 'vless://... ýa-da başga serwer konfigurasiýasy',
      saveRecordBtn: 'Saklamak',
      savingRecordBtn: 'Saklanýar...',
      savedRecordNotice: 'Üýtgetmeler saklandy we sinhronizirlendi',
      cancelEditBtn: 'Ýatyrmak',
      realServerConfigTitle: 'Serwer konfigurasiýasyndan alnan VPN kody',
      sourceBlockFix: 'Çeşme: serwer konfigurasiýasy',
      sourceBase64Badge: 'Base64 · VPN abunalygy',
      configReadyTitle: 'VPN kody döredildi we göçürmäge taýýar',
      configReadyDesc:
        'Doly VPN kody ekranda gizlenendir. Buferine göçürmek üçin aşakdaky «Göçürmek» ýa-da «Göçür we çyk» düwmelerini ulanyň.',
      noConfigTitle: 'Serwer konfigurasiýasy entek goşulmady',
      noConfigDesc:
        'Panel toslama salgylary, UUID ýa-da işjeň kodlary döretmeýär. Hakyky serwer konfigurasiýasyny «Sazlamalar → Gorag açary → Blogy düzetmek» bölüminde saklaň.',
      syncFromBlockBtn: '«Blogy düzetmek» bölüminden almak',
      goToBlockFix: 'Gorag açary → Blogy düzetmek bölümine geçmek',
      pingCheckTitle: 'Hakyky ping barlagy',
      pingCheckingDesc: 'Serwer düwünine hakyky TCP birikmesi barlanýar...',
      pingNodePrefix: (hp) => `Düwün: ${hp}`,
      pingNodeMissing: 'Konfigurasiýada serwer salgysy we porty görkezilmedik',
      checkingPing: 'Barlanýar...',
      checkPingBtn: 'Ping barlamak',
      serverReachable: (ms) => `Serwer elýeterli · Ping: ${ms} ms`,
      serverUnreachable: 'Serwer elýeterli däl',
      copyBtn: 'Göçürmek',
      copiedBtn: 'Göçürildi',
      copyAndExitBtn: 'Göçür we çyk',
    },
    settings: {
      backToHome: 'Baş sahypa',
      title: 'Sazlamalar',
      subtitle:
        'Interfeýs dili, gorag açary, umumy serwer bazasy we enjamlaryň sinhronizasiýasy',
      languageTitle: 'Interfeýs dili',
      languageDesc:
        'Dil saýlananda menýu, düwmeler, formalar we habarnamalar awtomatik terjime edilýär we ýatda saklanýar.',
      languageSaved: 'Dil saklandy',
      breadcrumbSettings: 'Sazlamalar',
      breadcrumbKey: 'Gorag açary',
      breadcrumbBlockFix: 'Blogy düzetmek',
      securitySectionTitle: 'Gorag açary we Blogy düzetmek',
      securitySectionDesc:
        'Serwerde giriş barlagy we Hysteria, ShadowSocks, VLESS, VMess, Trojan üçin hakyky serwer konfigurasiýalaryny dolandyrmak.',
      savedConfigsMeta: (count) => `Saklanan konfigurasiýalar: ${count}`,
      statusLabel: 'Ýagdaýy:',
      statusUnlocked: 'Giriş açyk',
      statusNeedCheck: 'Her gezek girilende açar talap edilýär',
      openSecurityKeyBtn: 'Gorag açaryny açmak',
      archTitle: 'Serwer birikdirme arhitekturasy',
      archDesc:
        'API arkaly daşarky VPN serwerlerini sinhronlamak we birikdirmek üçin adapter sazlamalary. Toslama birikmeler döredilmeýär.',
      adapterModeLabel: 'Adapter tertibi',
      adapterModeLocal: 'Serwer SQLite bazasy + hakyky TCP ping',
      adapterModeRest: 'Serwer bazasy + WebSocket / REST API sinhronizasiýasy',
      authHeaderLabel: 'API awtorizasiýa sözbaşysy',
      apiBaseUrlLabel: 'Daşarky dolandyryş serweriniň URL-i (hökmany däl)',
      syncPathLabel: 'Sinhronizasiýa ýoly',
      autoPingCheckbox:
        'Ýazgy döredilenden soň hakyky pingi awtomatik barlamak (serwer salgysy tapylsa)',
      base64ToggleTitle: 'Kody Base64 görnüşine öwürmek',
      base64ToggleDesc:
        'Döredilýän we täzelenýän VLESS konfigurasiýalaryny Base64 formatyna öwürmek (iki gezek kodirlemesiz)',
      saveSettingsBtn: 'Sazlamalary saklamak',
      savedBtn: 'Saklandy',
      localStorageTitle: 'Umumy serwer maglumat bazasy',
      localStorageDesc:
        'Maglumatlar Firebase ulanylmazdan serwerdäki umumy SQLite bazasynda saklanýar we WebSocket arkaly enjamlaryň arasynda hakyky wagtda sinhronlanýar.',
      exportJsonBtn: 'JSON eksport',
      confirmClearBtn: (count) => `Arassalamagy tassykla (${count})`,
      cancelBtn: 'Ýatyrmak',
      clearAllCodesBtn: 'Ähli döredilen kodlary pozmak',
      logoutAdminBtn: 'Administrator hasabyndan çykmak',
    },
    securityBlock: {
      backToSettings: 'Sazlamalara gaýtmak',
      verifyTitle: 'Gorag açaryny barlamak',
      verifyDesc:
        '«Blogy düzetmek» bölümine girmek üçin gorag açaryny giriziň. Barlag serwerde geçirilýär.',
      autoLockNote:
        '«Yza» basylanda, bölüm ýapylanda ýa-da sahypa täzelenende giriş awtomatik ýapylýar.',
      keyLabel: 'Gorag açary',
      keyPlaceholder: 'Gorag açaryny giriziň',
      showKey: 'Açary görkezmek',
      hideKey: 'Açary gizlemek',
      errEnterKey: 'Gorag açaryny giriziň',
      errInvalidKey: 'Nädogry gorag açary',
      errServerUnavailable: 'Serwerde açary barlap bolmady',
      errMissingEnvVars: 'Serwerde hökmany gizlin gurşaw üýtgeýjileri sazlanmandyr.',
      verifyAndEnter: 'Barla we gir',
      verifyingBtn: 'Açar barlanýar...',
      accessConfirmed: 'Giriş serwer tarapyndan tassyklandy',
      title: 'Blogy düzetmek',
      desc: 'Her protokol üçin hakyky serwer konfigurasiýalaryny goşuň. Olar serwerde saklanýar we VPN kodlary döredilende ulanylýar.',
      lockBtn: 'Girişi ýapmak',
      protocolLabel: 'Protokol',
      protocolTabsLabel: 'Konfigurasiýa üçin protokoly saýlaň',
      countryScopeLabel: 'Ýurda birikdirmek',
      allCountriesDefault: 'Ähli ýurtlar (deslapky)',
      configForProtocolLabel: (p) => `${p} üçin hakyky serwer konfigurasiýasy`,
      configPlaceholder: (hint) => `${hint}`,
      parsedEndpointPrefix: 'Ping üçin awtomatik tapylan düwün:',
      endpointNotParsed: 'Konfigurasiýadan salgy we port tapylmady',
      adminNoteLabel: 'Administrator belligi (hökmany däl)',
      adminNotePlaceholder: 'Mysal: Esasy NL düwüni',
      errEmptyConfig:
        'Saklamazdan öň hakyky serwer konfigurasiýasyny giriziň',
      saveConfigBtn: 'Konfigurasiýany saklamak',
      configSavedBtn: 'Konfigurasiýa saklandy',
      savedListTitle: 'Saklanan serwer konfigurasiýalary',
      countUnit: (c) => `${c} sany`,
      savedListEmpty:
        'Entek saklanan konfigurasiýa ýok. Ýokardan protokoly saýlaň we hakyky serwer konfigurasiýasyny saklaň.',
      editBtn: 'Üýtgetmek',
      confirmDeleteBtn: 'Pozmalymy?',
      cancelDeleteBtn: 'Ýatyrmak',
    },
    errors: {
      loadFailed: 'Serwerden saklanan maglumatlary ýükläp bolmady. Baglanyşygy barlap, täzeden synanyşyň.',
      saveFailed: 'Serwer ýatda saklamagy tassyklamady. Täzeden synanyşyň.',
      deleteFailed: 'Serwer pozmagy tassyklamady. Ýazgy bazada galdy.',
      storageUnavailable: 'Serweriň hemişelik ammary wagtlaýyn elýeterli däl.',
      retryBtn: 'Täzeden',
      dismissBtn: 'Ýapmak',
    },
    protocols: {
      Hysteria: 'QUIC esasynda çalt transport',
      ShadowSocks: 'Ýeňil şifrlenen SOCKS5 tuneli',
      VLESS: 'Artykmaç ýüksüz häzirki zaman Xray protokoly',
      VMess: 'JSON sazlamaly V2Ray konfigurasiýasy',
      Trojan: 'Trafiki HTTPS/TLS görnüşinde gizlemek',
    },
    countries: {
      Туркменистан: { name: 'Türkmenistan', region: 'Merkezi Aziýa' },
      Россия: { name: 'Russiýa', region: 'Gündogar Ýewropa' },
      Нидерланды: { name: 'Niderlandlar', region: 'Günbatar Ýewropa' },
      Германия: { name: 'Germaniýa', region: 'Merkezi Ýewropa' },
      Британия: { name: 'Britaniýa', region: 'Demirgazyk Ýewropa' },
      Швеция: { name: 'Şwesiýa', region: 'Skandinawiýa' },
    },
    pingErrors: {
      NO_ENDPOINT: 'Serwer konfigurasiýasynda salgy we port tapylmady',
      TIMEOUT: 'Garaşma wagty gutardy (4 s)',
      CONNREFUSED: 'Serwer birikmäni ret etdi (port ýapyk)',
      NOTFOUND: 'Serweriň domen ady tapylmady (DNS)',
      UNREACHABLE: 'Serwer tor boýunça elýeterli däl',
      NETWORK: 'Serwer tor boýunça elýeterli däl',
      INVALID_RESPONSE: 'Serwer elýeterliligi barlagy şowsuz boldy',
      LOCAL_SERVER_ERROR:
        'Ýerli serwer arkaly tor barlagyny geçirip bolmady',
    },
  },
};

export function getCountryDisplayName(
  country: VpnCountry,
  lang: AppLanguage
): string {
  return TRANSLATIONS[lang].countries[country].name;
}

export function getScopeLabelLocalized(
  scope: CountryScope,
  lang: AppLanguage
): string {
  if (scope === 'ALL') {
    return TRANSLATIONS[lang].securityBlock.allCountriesDefault;
  }
  return getCountryDisplayName(scope, lang);
}
