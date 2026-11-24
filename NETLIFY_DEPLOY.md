# Развёртывание VEXTON VPN CODE GENERATOR на Netlify

Проект полностью подготовлен для публикации на **Netlify** (`https://ваше-название.netlify.app`) с сохранением:
- тёмно-фиолетового дизайна;
- всех 3 языков (`ru`, `en`, `tk`);
- всех 5 протоколов (`Hysteria`, `ShadowSocks`, `VLESS`, `VMess`, `Trojan`) и 6 стран;
- серверной авторизации с постоянной `HttpOnly` cookie-сессией (код входа администратора настраивается на сервере);
- отдельного серверного ключа раздела «Исправление блока» (`VEXTON_SECURITY_KEY`);
- общей серверной базы и синхронизации между устройствами через **Netlify Functions** (`/api/*`) и **Netlify Blobs** (либо опционально Upstash Redis).

---

## Что подготовлено в комплекте

1. **`netlify.toml`** — конфигурация сборки (`npm run build` -> `dist/`), папка serverless-функций (`netlify/functions`), правила маршрутизации `/api/* -> /.netlify/functions/api/:splat`, SPA fallback и заголовки кэширования/безопасности.
2. **`netlify/functions/api.ts` и `netlify/lib/store.ts`** — серверное API для Netlify:
   - авторизация администратора (`/api/auth/login`, `/api/auth/me`, `/api/auth/logout`);
   - проверка ключа «Исправление блока» (`/api/security/verify`);
   - хранение VPN-кодов, шаблонов серверов, архитектуры и активных сессий в **Netlify Blobs** (с сильной согласованностью и защитой от конфликтов записи);
   - реальная TCP-проверка пинга (`/api/ping`).
3. **`public/favicon.svg` и `public/_redirects`** — иконка сайта и правила маршрутизации в сборке.
4. **Папка `dist/`** — готовая статическая сборка фронтенда (HTML, CSS, JS, `favicon.svg`, `_redirects`).
   > **Важно:** папка `dist/` содержит только клиентскую часть без секретов. Для работы авторизации и общей базы на Netlify сайт должен разворачиваться целиком (вместе с `netlify.toml` и `netlify/functions/`), а не только как статическая папка `dist/` без функций.
5. **Архив `vexton-vpn-netlify-ready.zip`** — готовый архив исходников (без `node_modules`, локальной базы `data/`, `.env*` и временных файлов) для загрузки на GitHub или деплоя на Netlify.

---

## Обязательные переменные окружения на Netlify

В панели Netlify перейдите в **Site configuration → Environment variables** и задайте переменные (секреты не вшиваются в публичный HTML/CSS/JS):

| Переменная | Назначение | Пример / значение |
|---|---|---|
| `VEXTON_ADMIN_USER` | Логин администратора | `admin` |
| `VEXTON_ADMIN_PASSWORD` | Код/пароль входа в админ-панель | `<ВАШ_КОД_АДМИНИСТРАТОРА>` |
| `VEXTON_SECURITY_KEY` | Защитный ключ раздела «Исправление блока» | `<ВАШ_ЗАЩИТНЫЙ_КЛЮЧ>` |
| `VEXTON_SESSION_SECRET` | Секретный ключ подписи `HttpOnly` cookie-сессий | Любая длинная случайная строка (32+ символов) |

> **Строгая проверка секретов на Netlify / Production:** если хотя бы одна из обязательных переменных (`VEXTON_ADMIN_PASSWORD`, `VEXTON_SECURITY_KEY`, `VEXTON_SESSION_SECRET`) не задана в настройках сайта, сервер блокирует вход и проверку ключа (HTTP `503`, `SERVER_CONFIG_ERROR`) и не допускает использование запасных значений по умолчанию.

### Опционально (внешний Redis вместо Netlify Blobs)
Netlify Blobs подключается **автоматически** и бесплатно на всех сайтах Netlify — дополнительные ключи не требуются. Если в будущем понадобится внешняя база Upstash Redis, достаточно добавить:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## Способ 1: Публикация через GitHub → Netlify (рекомендуется)

1. Распакуйте `vexton-vpn-netlify-ready.zip` и загрузите файлы в приватный репозиторий GitHub.
2. Войдите на [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub**.
3. Выберите свой репозиторий. Параметры подтянутся автоматически из `netlify.toml`:
   - **Build command:** задана в `netlify.toml`: если Vite не установлен, сначала выполняется `npm ci`, затем `npm run build`.
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Перед нажатием **Deploy site** откройте **Environment variables** и добавьте переменные из таблицы выше (`VEXTON_ADMIN_USER`, `VEXTON_ADMIN_PASSWORD`, `VEXTON_SECURITY_KEY`, `VEXTON_SESSION_SECRET`).
5. Нажмите **Deploy site**.
6. После сборки в настройках сайта (**Site settings → Domain management**) при желании измените случайное имя поддомена на своё: `ваше-название.netlify.app`.

---

## Способ 2: Публикация через Netlify CLI (без GitHub)

Если хотите выгрузить сайт напрямую с компьютера или сервера:

```bash
# 1. Распакуйте vexton-vpn-netlify-ready.zip и перейдите в папку проекта
npm ci

# 2. Установите Netlify CLI (если ещё не установлен) и войдите в аккаунт
npm install -g netlify-cli
netlify login

# 3. Создайте сайт на Netlify и привяжите проект
netlify init

# 4. Задайте переменные окружения на сервере Netlify
netlify env:set VEXTON_ADMIN_USER "admin"
netlify env:set VEXTON_ADMIN_PASSWORD "<ВАШ_КОД_АДМИНИСТРАТОРА>"
netlify env:set VEXTON_SECURITY_KEY "<ВАШ_ЗАЩИТНЫЙ_КЛЮЧ>"
netlify env:set VEXTON_SESSION_SECRET "ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ"

# 5. Соберите и опубликуйте сайт (клиент + Functions)
npm run build
netlify deploy --prod
```

---

## Как обновлять сайт на Netlify в будущем

- **Если публиковали через GitHub:** просто отправьте изменения (`git push`) в основную ветку репозитория — Netlify автоматически пересоберёт `dist/` и `netlify/functions/`, сохранив все данные в Netlify Blobs.
- **Если публиковали через Netlify CLI:** выполните в папке проекта:
  ```bash
  npm run build
  netlify deploy --prod
  ```
- **Если меняете пароли/ключи (`VEXTON_ADMIN_PASSWORD`, `VEXTON_SECURITY_KEY`):** обновите их в **Netlify → Site configuration → Environment variables**, затем выполните **Trigger deploy → Deploy site**, чтобы serverless-функции подхватили новые значения.
