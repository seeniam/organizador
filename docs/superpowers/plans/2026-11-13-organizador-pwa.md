# Organizador PWA: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA mobile-first (responsivo para tablet e desktop) para organizar tarefas e compromissos de lazer e profissionais, com login Google e lembretes por Web Push disparados pelo servidor.

**Architecture:** SPA React estática na Vercel, que conversa direto com o Supabase (Auth Google + Postgres com RLS). Os lembretes são calculados no banco (`remind_at` por trigger). Um `pg_cron` chama a cada minuto a Edge Function `send-reminders`, que reivindica os lembretes vencidos de forma atômica e envia Web Push (VAPID) para todos os dispositivos do usuário. Um service worker próprio (`injectManifest`) faz o cache do shell e trata `push` e `notificationclick`.

**Tech Stack:** Vite + React + TypeScript, react-router-dom, Tailwind CSS, TanStack Query (com persistência em localStorage), date-fns + date-fns-tz (pt-BR), vite-plugin-pwa (injectManifest, Workbox), @supabase/supabase-js, Supabase CLI (migrations, pgTAP, Edge Functions em Deno), Vitest + Testing Library, Vercel CLI.

**Spec:** `docs/superpowers/specs/2026-11-13-organizador-pwa-design.md`

**Ambiente:** projeto em `C:\Users\neemi\organizador` (repositório git já iniciado, branch `main`). Node 26, npm 11, Docker 29 e Supabase CLI 3.1 (via `npx supabase`) disponíveis. O stack local do Supabase (`npx supabase start`) é usado para os testes SQL e das Edge Functions.

## Global Constraints

- Todo texto de interface em português do Brasil.
- Breakpoints: celular `< 768px`, tablet `768–1199px`, desktop `≥ 1200px`.
- Valores de lembrete permitidos: `0`, `10`, `60`, `1440` minutos, ou `null` (sem lembrete). Rótulos: "Na hora", "10 min antes", "1 h antes", "1 dia antes", "Sem lembrete".
- Lembrete de item `all_day`: calculado a partir das **09:00** no fuso (`timezone`) do item.
- Limites por usuário: **2.000** itens e **10** inscrições de push.
- Lembretes atrasados mais de **1 hora** são marcados como enviados sem notificar.
- O cron roda **a cada minuto**.
- Escopos do Google: apenas `openid`, `email`, `profile`.
- Só planos gratuitos (Supabase Free, Vercel Hobby). Nenhum serviço que exija cartão.
- Compromissos (`kind = 'event'`) nunca têm `done_at`, círculo de concluir ou gesto de concluir, e nunca aparecem como atrasados.
- A permissão de notificação só é pedida por ação explícita do usuário, nunca ao abrir o app.
- A chave VAPID privada nunca vai para o front nem para o repositório.
- Cores das categorias são consistentes em todo o app; tema claro/escuro segue o sistema.

## Review Focus

1. **Fuso horário e itens de dia inteiro:** um item `all_day` criado em São Paulo continua no mesmo dia mesmo quando o dispositivo está em outro fuso, e o lembrete sai às 09:00 do fuso do item. → testes em Task 3 (`bucketize` com `all_day` e fuso diferente) e Task 2 (trigger com `America/Sao_Paulo`).
2. **Editar um item depois que o lembrete já foi enviado:** um novo horário gera exatamente um novo lembrete; editar só o título não gera lembrete repetido. → teste pgTAP em Task 2.
3. **Inscrição de push expirada ou de vários dispositivos:** um 404/410 apaga só aquela inscrição, e os outros dispositivos continuam recebendo. → teste em Task 9 (`sendToUser` com mock de 410).
4. **Abrir o app offline ou com a sessão expirada:** o app mostra os dados em cache com o aviso "Sem conexão", desabilita escrita e não entra em loop de login. → teste em Task 5 (`useOnline` + botão desabilitado) e Task 4 (guard sem sessão vai para `/login` uma única vez).
5. **Tocar na notificação com o app já aberto em outra aba:** foca a aba existente e abre o item, sem abrir uma janela nova. → teste em Task 8 (`handleNotificationClick` com cliente existente).

---

## Estrutura de arquivos

```
organizador/
  index.html
  vite.config.ts                 # React + vite-plugin-pwa (injectManifest) + Vitest
  tailwind.config.ts, postcss.config.js
  vercel.json                    # rewrite SPA -> /index.html
  .env.example
  public/icons/                  # ícones PWA 192, 512, maskable, apple-touch
  src/
    main.tsx, App.tsx            # providers + rotas
    sw.ts                        # service worker (precache, push, notificationclick)
    sw-handlers.ts               # lógica testável do SW
    lib/
      types.ts                   # Item, ItemInput, Category, ItemKind, Filter
      dates.ts                   # helpers de fuso e formatação
      buckets.ts                 # regras de Hoje/Próximos/Histórico/Calendário
      form.ts                    # formulário <-> ItemInput, validação
      supabase.ts                # client
      push.ts                    # suporte, inscrição, cancelamento
      online.ts                  # useOnline()
    auth/AuthProvider.tsx, RequireAuth.tsx
    data/items.ts                # API + hooks TanStack Query
    data/queryClient.ts          # QueryClient + persistência
    ui/                          # AppShell, NavBar, SideNav, FilterChips, ItemRow, ItemList, Sheet, Toast, EnableRemindersCard
    pages/                       # Login, Privacy, Today, Upcoming, Calendar, History, Settings
    editor/ItemEditor.tsx
  supabase/
    config.toml
    migrations/                  # 0001_schema.sql, 0002_reminders.sql, 0003_cron.sql
    tests/database/*.test.sql    # pgTAP
    functions/_shared/push.ts, send-reminders/, send-test-push/, delete-account/
  README.md
```

## Tipos compartilhados (definidos na Task 3, usados por todas)

```ts
export type ItemKind = 'task' | 'event';
export type Category = 'leisure' | 'work';
export type Filter = 'all' | Category;
export type ReminderMinutes = 0 | 10 | 60 | 1440 | null;

export interface Item {
  id: string; user_id: string; kind: ItemKind; category: Category;
  title: string; notes: string | null;
  starts_at: string | null; ends_at: string | null;   // ISO UTC
  all_day: boolean; timezone: string;                  // IANA
  reminder_minutes: ReminderMinutes;
  remind_at: string | null; reminder_sent_at: string | null;
  done_at: string | null; created_at: string; updated_at: string;
}
export type ItemInput = Pick<Item, 'kind'|'category'|'title'|'notes'|'starts_at'|'ends_at'|'all_day'|'timezone'|'reminder_minutes'>;
```

Convenção: item `all_day` guarda `starts_at` = 00:00 do dia no fuso `timezone` do item. O "dia" de um item `all_day` é sempre calculado no fuso do item; o de um item com hora é calculado no fuso do visualizador.

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.ts`, `postcss.config.js`, `vercel.json`, `.env.example`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test` (Vitest, jsdom), `npm run typecheck`. Aliás `@/` → `src/`.

- [ ] **Step 1:** Criar o projeto Vite React-TS em `C:\Users\neemi\organizador` (sem apagar `docs/` nem `.git`). Instalar com versões atuais fixadas: `react-router-dom`, `@tanstack/react-query`, `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister`, `@supabase/supabase-js`, `date-fns`, `date-fns-tz`, `clsx`; dev: `tailwindcss`, `vite-plugin-pwa`, `workbox-precaching`, `workbox-routing`, `workbox-strategies`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
- [ ] **Step 2:** Escrever o teste `App.test.tsx`: `renders without crashing` renderiza `<App />` e verifica que `document.body` contém um elemento `main`.
- [ ] **Step 3:** Rodar `npm test`. Esperado: FAIL (App ainda é o template).
- [ ] **Step 4:** `App.tsx` mínimo com `<main>`; configurar Tailwind (`darkMode: 'media'`), Vitest (`environment: 'jsdom'`, `setupFiles: src/test/setup.ts`), `vite-plugin-pwa` com `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, manifesto (`name: "Organizador"`, `short_name: "Organizador"`, `lang: "pt-BR"`, `display: "standalone"`, `start_url: "/"`, ícones 192/512/maskable). `src/sw.ts` provisório só com `precacheAndRoute(self.__WB_MANIFEST)`. `vercel.json`: `{"rewrites":[{"source":"/((?!.*\\.).*)","destination":"/index.html"}]}`. `.env.example` com `VITE_SUPABASE_URL=`, `VITE_SUPABASE_ANON_KEY=`, `VITE_VAPID_PUBLIC_KEY=`. Ícones gerados (SVG simples → PNG) em `public/icons/`.
- [ ] **Step 5:** Rodar `npm test && npm run typecheck && npm run build`. Esperado: tudo passa e `dist/sw.js` e `dist/manifest.webmanifest` existem.
- [ ] **Step 6:** Commit `chore: scaffold Vite React PWA`.

### Task 2: Banco de dados (schema, RLS, triggers, reivindicação de lembretes)

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261113000001_schema.sql`, `supabase/migrations/20261113000002_reminders.sql`
- Test: `supabase/tests/database/items.test.sql`, `supabase/tests/database/reminders.test.sql`

**Interfaces:**
- Produces: tabelas `public.items` e `public.push_subscriptions` com as colunas do spec; função `public.claim_due_reminders(max_rows int default 200) returns setof public.items` (somente `service_role`); erros `limite_itens` e `limite_dispositivos` (SQLSTATE `P0001`, mensagem exatamente essa).

- [ ] **Step 1: Escrever os testes pgTAP**

`items.test.sql` deve cobrir:
- RLS: com `set local role authenticated` + `request.jwt.claims` do usuário A, `select` não retorna itens do usuário B; `insert` com `user_id` de B falha.
- Constraints: `event` sem `starts_at` falha; `ends_at <= starts_at` falha; `event` com `done_at` falha; `reminder_minutes = 5` falha; `title = ''` falha.
- Limites: o 2.001º item do mesmo usuário lança `limite_itens`; a 11ª inscrição lança `limite_dispositivos`.
- `push_subscriptions.endpoint` é único.

`reminders.test.sql` deve cobrir (todos com `timezone = 'America/Sao_Paulo'`):
- Item com hora `2026-12-01 14:00-03`, `reminder_minutes = 60` → `remind_at = '2026-12-01 13:00-03'`.
- `all_day`, `starts_at = '2026-12-01 00:00-03'`, `reminder_minutes = 0` → `remind_at = '2026-12-01 09:00-03'`; com `1440` → `'2026-11-30 09:00-03'`.
- `reminder_minutes = null` ou `starts_at = null` → `remind_at is null`.
- Depois de `reminder_sent_at` preenchido, mudar `starts_at` zera `reminder_sent_at` e recalcula `remind_at`; mudar só `title` mantém `reminder_sent_at`.
- `claim_due_reminders()`: retorna o item com `remind_at = now() - 1 minute` e preenche `reminder_sent_at`; segunda chamada não retorna nada; item com `remind_at = now() - 2 hours` não é retornado, mas fica com `reminder_sent_at` preenchido; tarefa com `done_at` não é retornada; papel `authenticated` não pode executar a função.

- [ ] **Step 2:** `npx supabase start` e `npx supabase test db`. Esperado: FAIL (tabelas não existem).
- [ ] **Step 3: Migração `schema`:** tabelas com `check`s (`kind in ('task','event')`, `category in ('leisure','work')`, `char_length(title) between 1 and 200`, `reminder_minutes in (0,10,60,1440)`, `kind <> 'event' or starts_at is not null`, `ends_at is null or (kind = 'event' and ends_at > starts_at)`, `kind = 'task' or done_at is null`), `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `timezone text not null default 'America/Sao_Paulo'`, trigger de `updated_at`, RLS em ambas (`using/with check (user_id = (select auth.uid()))`), triggers `before insert` de limite, índice parcial `items (remind_at) where reminder_sent_at is null and done_at is null`, índice `items (user_id, starts_at)`.
- [ ] **Step 4: Migração `reminders`:** trigger `before insert or update` que calcula `remind_at`. Para `all_day`: `(((starts_at at time zone timezone)::date + time '09:00') at time zone timezone) - make_interval(mins => reminder_minutes)`; senão `starts_at - make_interval(mins => reminder_minutes)`. Em `update`, se `starts_at`, `reminder_minutes`, `all_day` ou `timezone` mudaram, zera `reminder_sent_at`. Função `claim_due_reminders` (`security definer`, `set search_path = ''`, `revoke execute from public, anon, authenticated`; `grant` a `service_role`): primeiro marca como enviados, sem retornar, os vencidos há mais de 1 hora; depois `update ... set reminder_sent_at = now() where id in (select id ... where remind_at <= now() and reminder_sent_at is null and done_at is null order by remind_at limit max_rows for update skip locked) returning *`.
- [ ] **Step 5:** `npx supabase db reset && npx supabase test db`. Esperado: PASS.
- [ ] **Step 6:** Commit `feat(db): schema, RLS, lembretes`.

### Task 3: Lógica de domínio (tipos, datas, agrupamento, formulário)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/dates.ts`, `src/lib/buckets.ts`, `src/lib/form.ts`
- Test: `src/lib/buckets.test.ts`, `src/lib/form.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: tipos da seção "Tipos compartilhados" + `REMINDER_OPTIONS: {value: ReminderMinutes; label: string}[]` + `CATEGORY_LABEL: Record<Category,string>` (`leisure: 'Lazer'`, `work: 'Profissional'`).
  - `dates.ts`: `deviceTimeZone(): string`; `itemDay(item: Item, viewerTz: string): string | null` (`yyyy-MM-dd`; usa `item.timezone` se `all_day`); `formatItemTime(item: Item, viewerTz: string): string` (`"14:30"`, `"14:30–15:30"` ou `"Dia inteiro"`); `formatDayHeading(day: string, todayDay: string): string` (`"Hoje"`, `"Amanhã"`, senão `"seg., 1 de dez."` em pt-BR).
  - `buckets.ts`: `isEventPast(item: Item, now: Date): boolean`; `isOverdue(item: Item, now: Date, viewerTz: string): boolean`; `filterByCategory(items: Item[], f: Filter): Item[]`; `bucketize(items: Item[], now: Date, viewerTz: string): Buckets`; `itemsOnDay(items: Item[], day: string, viewerTz: string): Item[]`; `daysWithItems(items: Item[], month: string /* yyyy-MM */, viewerTz: string): Map<string, Category[]>`.
    ```ts
    interface DayGroup { day: string; items: Item[] }
    interface Buckets { overdue: Item[]; today: Item[]; noDate: Item[]; upcoming: DayGroup[]; history: DayGroup[] }
    ```
  - `form.ts`: `ItemFormValues = { kind; category; title: string; notes: string; date: string; time: string; endTime: string; allDay: boolean; reminder: '' | '0' | '10' | '60' | '1440' }`; `emptyForm(kind: ItemKind, date?: string): ItemFormValues`; `validateForm(v: ItemFormValues): Partial<Record<keyof ItemFormValues, string>>`; `formToInput(v: ItemFormValues, tz: string): ItemInput`; `itemToForm(item: Item): ItemFormValues`.

- [ ] **Step 1: Escrever `buckets.test.ts`** com `viewerTz = 'America/Sao_Paulo'` e `now = 2026-12-01T15:00:00-03:00`:
  - tarefa `done_at` em 2026-11-30 → `history[0].day === '2026-11-30'`.
  - tarefa pendente sem `starts_at` → `noDate`.
  - tarefa pendente com hora `2026-12-01T10:00-03` → `overdue` (passou da hora); `2026-12-01T18:00-03` → `today`; `2026-11-29` all_day → `overdue`; `2026-12-01` all_day → `today`; `2026-12-03T09:00-03` → `upcoming` com `day '2026-12-03'`.
  - compromisso `2026-12-01T09:00–10:00-03` → `today` (não `overdue`), e `isEventPast` é `true`.
  - compromisso de `2026-11-30` → `history`, nunca `overdue`.
  - compromisso que começou `2026-11-30T20:00-03` e termina `2026-12-02T10:00-03` → `today`.
  - **Review Focus 1:** item `all_day` com `timezone 'America/Sao_Paulo'`, `starts_at '2026-12-01T03:00Z'`, visto com `viewerTz 'Asia/Tokyo'` → `itemDay` retorna `'2026-12-01'`.
  - ordenação: `today` traz all_day primeiro e depois por horário; `upcoming` em ordem crescente de dia; `history` em ordem decrescente.
  - `filterByCategory(items, 'work')` mantém só `work`; `'all'` mantém tudo.
  - `daysWithItems(items, '2026-12', tz).get('2026-12-01')` contém as categorias distintas daquele dia.
- [ ] **Step 2: Escrever `form.test.ts`:**
  - `validateForm` com título vazio → `{title: 'Informe um título'}`; compromisso sem data → `{date: 'Compromissos precisam de data'}`; compromisso sem hora e sem `allDay` → `{time: 'Informe a hora'}`; `endTime <= time` → `{endTime: 'O fim deve ser depois do início'}`; lembrete com data vazia → `{reminder: 'Defina uma data para usar lembrete'}`.
  - `formToInput({date:'2026-12-01', time:'14:30', allDay:false,...}, 'America/Sao_Paulo').starts_at === '2026-12-01T17:30:00.000Z'`.
  - `allDay: true` → `starts_at === '2026-12-01T03:00:00.000Z'`, `ends_at === null`, `all_day === true`.
  - tarefa sem data → `starts_at === null`, `reminder_minutes === null`.
  - `itemToForm(formToInput(v))` faz a ida e volta dos campos.
- [ ] **Step 3:** `npm test src/lib`. Esperado: FAIL.
- [ ] **Step 4:** Implementar com `date-fns-tz` (`fromZonedTime`, `formatInTimeZone`) e locale `ptBR`. Regras de `bucketize`: tarefa concluída → history (dia de `done_at` no fuso do visualizador); tarefa sem data → noDate; tarefa com data → `isOverdue` (com hora: `starts_at < now`; all_day: dia < hoje) → overdue; dia = hoje → today; senão upcoming. Compromisso: dia de início > hoje → upcoming; dia de início = hoje, ou início antes de hoje e `(ends_at ?? starts_at) >= início de hoje` → today; senão history (agrupado pelo dia de início).
- [ ] **Step 5:** `npm test src/lib`. Esperado: PASS.
- [ ] **Step 6:** Commit `feat: regras de agrupamento e formulário`.

### Task 4: Autenticação, rotas, Login e Privacidade

**Files:**
- Create: `src/lib/supabase.ts`, `src/auth/AuthProvider.tsx`, `src/auth/RequireAuth.tsx`, `src/pages/Login.tsx`, `src/pages/Privacy.tsx`
- Modify: `src/App.tsx`
- Test: `src/auth/RequireAuth.test.tsx`, `src/pages/Login.test.tsx`

**Interfaces:**
- Produces: `supabase: SupabaseClient` (de `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`); `useAuth(): { session: Session | null; user: User | null; loading: boolean; signInWithGoogle(): Promise<void>; signOut(): Promise<void> }`; rotas `/login`, `/privacidade` (públicas), `/`, `/proximos`, `/calendario`, `/historico`, `/configuracoes` (protegidas, com `AppShell` da Task 6; até lá, um placeholder).

- [ ] **Step 1: Testes:** `RequireAuth` com `loading: true` renderiza um indicador e não redireciona; com `session: null` navega para `/login` (uma única navegação, preservando `?item=` em `state.from`); com sessão renderiza os filhos. `Login` mostra o botão "Entrar com Google" que chama `signInWithGoogle`, e o link "Política de privacidade" para `/privacidade`.
- [ ] **Step 2:** `npm test src/auth src/pages`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `signInWithGoogle` = `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` (escopos padrão do Supabase = `openid email profile`). `AuthProvider` usa `getSession` + `onAuthStateChange`. Após login, volta para `state.from` ou `/`. `Privacy.tsx`: texto estático em pt-BR explicando quais dados guardamos (nome, e-mail e foto do Google; itens; inscrições de push), para quê, que não compartilhamos, e como excluir a conta (Configurações → Excluir conta).
- [ ] **Step 4:** `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: login Google e rotas`.

### Task 5: Camada de dados e offline

**Files:**
- Create: `src/data/queryClient.ts`, `src/data/items.ts`, `src/lib/online.ts`
- Test: `src/data/items.test.ts`, `src/lib/online.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `Item`, `ItemInput`.
- Produces: `queryClient`, `persister` e `clearPersistedCache(): void`; `useItems(): UseQueryResult<Item[]>` (chave `['items']`, todos os itens do usuário); `useCreateItem()`, `useUpdateItem()` (`{id, patch: Partial<ItemInput>}`), `useDeleteItem()`, `useToggleDone()` (`{id, done: boolean}`, só tarefa); `useOnline(): boolean`; `friendlyError(e: unknown): string`.

- [ ] **Step 1: Testes** (com o `supabase` mockado via `vi.mock`): `useCreateItem` chama `from('items').insert(input).select().single()` e invalida `['items']`; `useToggleDone({id, done:true})` envia `done_at` como string ISO, e `done:false` envia `null`; `friendlyError` com mensagem `limite_itens` → `'Você atingiu o limite de 2.000 itens.'`; `useOnline` muda para `false` ao disparar o evento `offline` e volta para `true` com `online`.
- [ ] **Step 2:** `npm test src/data src/lib/online`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `QueryClient` com `gcTime: 7 dias`, e `PersistQueryClientProvider` com o persister de localStorage (chave `organizador-cache`). Mutations com atualização otimista em `['items']` e rollback em erro. `clearPersistedCache` é chamado no `signOut`.
- [ ] **Step 4:** `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: camada de dados com cache offline`.

### Task 6: Shell responsivo, navegação e filtro

Antes de começar, carregar a skill `frontend-design:frontend-design` e definir a direção visual: tipografia, paleta (uma cor para Lazer e outra para Profissional, com contraste AA nos dois temas) e tokens em CSS variables no `index.css`.

**Files:**
- Create: `src/ui/AppShell.tsx`, `src/ui/BottomNav.tsx`, `src/ui/SideNav.tsx`, `src/ui/FilterChips.tsx`, `src/ui/OfflineBanner.tsx`, `src/ui/Fab.tsx`, `src/ui/filter.ts`
- Modify: `src/App.tsx`
- Test: `src/ui/AppShell.test.tsx`

**Interfaces:**
- Consumes: `useOnline`, `useAuth`.
- Produces: `useFilter(): [Filter, (f: Filter) => void]` (persistido em `localStorage['organizador-filtro']`, com try/catch); `AppShell` renderiza `<Outlet />`; `openEditor(params: {itemId?: string; kind?: ItemKind; date?: string})`, que escreve `?item=<id>` ou `?novo=task|event&data=yyyy-MM-dd` na URL.

- [ ] **Step 1: Testes:** os quatro destinos (Hoje, Próximos, Calendário, Histórico) mais Configurações estão presentes como links com `aria-current="page"` no ativo; `FilterChips` alterna o filtro e o valor sobrevive à troca de rota; com `useOnline() === false` aparece "Sem conexão. Mostrando os últimos dados salvos." e o FAB fica `disabled`.
- [ ] **Step 2:** `npm test src/ui`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Abaixo de `md` (768px): `BottomNav` fixa + FAB acima dela, respeitando `env(safe-area-inset-bottom)`. Em `md`: `SideNav` só com ícones. Em `xl` (1200px; configurar `screens.xl = '1200px'`): `SideNav` com rótulos e área principal com largura máxima. O FAB abre um menu com "Nova tarefa" e "Novo compromisso".
- [ ] **Step 4:** `npm test`. Esperado: PASS. Conferir visualmente com `npm run dev` em 375px, 834px e 1440px.
- [ ] **Step 5:** Commit `feat: shell responsivo e navegação`.

### Task 7: Telas de lista, calendário, editor e ações rápidas

**Files:**
- Create: `src/ui/ItemRow.tsx`, `src/ui/ItemList.tsx`, `src/ui/Sheet.tsx`, `src/ui/Toast.tsx`, `src/pages/Today.tsx`, `src/pages/Upcoming.tsx`, `src/pages/History.tsx`, `src/pages/Calendar.tsx`, `src/editor/ItemEditor.tsx`
- Test: `src/ui/ItemRow.test.tsx`, `src/pages/Today.test.tsx`, `src/editor/ItemEditor.test.tsx`

**Interfaces:**
- Consumes: `bucketize`, `itemsOnDay`, `daysWithItems`, `filterByCategory`, `formatItemTime`, `formatDayHeading`, hooks da Task 5, `useFilter`, `openEditor`.
- Produces: `useToast(): { show(msg: string, action?: {label: string; onClick(): void}): void }`; `ItemEditor` montado no `AppShell`, aberto sempre que a URL tiver `?item=` ou `?novo=`.

- [ ] **Step 1: Testes:**
  - `ItemRow` de tarefa tem um checkbox "Concluir <título>"; de compromisso **não tem** checkbox; compromisso passado tem `data-past="true"`; tarefa atrasada tem o rótulo "Atrasada"; a cor/rótulo da categoria aparece; offline, o checkbox fica `disabled` e o deslizar não faz nada.
  - `Today` com itens fixos (`now` injetável) mostra as seções "Atrasadas", "Hoje" e "Sem data", nessa ordem, e omite as vazias; o estado vazio mostra "Nada para hoje".
  - `ItemEditor`: ao escolher "Compromisso", aparecem "Hora de fim" e "Dia inteiro"; ao salvar com título vazio, mostra "Informe um título" e não chama `useCreateItem`; um formulário válido chama `create` com `formToInput(...)`; offline, o botão Salvar fica desabilitado; "Excluir" apaga e mostra o toast "Item excluído" com a ação "Desfazer" (que recria com o mesmo `ItemInput`).
- [ ] **Step 2:** `npm test src/ui src/pages src/editor`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `Sheet`: abaixo de `md`, folha que sobe de baixo (com foco preso e fechamento por Esc ou toque fora); em `md` ou mais, modal centralizado; em `xl`, painel lateral à direita. O deslizar no celular é feito com pointer events (sem biblioteca extra): à direita conclui (só tarefa), à esquerda exclui, ambos com toast "Desfazer". `Upcoming` e `History` usam `ItemList` com cabeçalhos de `formatDayHeading`; em History, "Desfazer" no círculo reabre a tarefa. `Calendar`: grade do mês (segunda a domingo), navegação entre meses, pontos por categoria vindos de `daysWithItems`, e lista do dia selecionado abaixo da grade (ao lado dela em `xl`); o FAB nessa tela pré-preenche a data selecionada. `?item=<id>` desconhecido mostra o toast "Item não encontrado" e limpa a URL.
- [ ] **Step 4:** `npm test`. Esperado: PASS. Conferir com `npm run dev` em 375px, 834px e 1440px: criar, editar, concluir, deslizar, excluir e desfazer.
- [ ] **Step 5:** Commit `feat: telas, editor e ações rápidas`.

### Task 8: Service worker e push no cliente

**Files:**
- Create: `src/sw-handlers.ts`, `src/lib/push.ts`, `src/ui/EnableRemindersCard.tsx`
- Modify: `src/sw.ts`, `src/pages/Today.tsx` (mostra o card)
- Test: `src/sw-handlers.test.ts`, `src/lib/push.test.ts`, `src/ui/EnableRemindersCard.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `VITE_VAPID_PUBLIC_KEY`.
- Produces:
  - Carga de push (contrato com a Task 9): `interface PushPayload { title: string; body: string; itemId: string | null; url: string; tag: string }`.
  - `sw-handlers.ts`: `notificationOptions(p: PushPayload): NotificationOptions` (`body`, `tag`, `icon: '/icons/icon-192.png'`, `badge`, `data: { url }`); `handleNotificationClick(url: string, clients: Clients): Promise<void>`.
  - `push.ts`: `pushSupport(): 'unsupported' | 'ios-needs-install' | 'supported'`; `isDeviceSubscribed(): Promise<boolean>`; `subscribeDevice(): Promise<'granted' | 'denied'>`; `unsubscribeDevice(): Promise<void>`; `urlBase64ToUint8Array(s: string): Uint8Array`.

- [ ] **Step 1: Testes:**
  - **Review Focus 5:** `handleNotificationClick('/?item=abc', clients)` com um `WindowClient` já aberto na mesma origem chama `client.focus()` e `client.navigate('/?item=abc')`, e **não** chama `clients.openWindow`; sem cliente aberto, chama `openWindow('/?item=abc')`.
  - `pushSupport()`: com UA de iPhone e `navigator.standalone !== true` (e sem `display-mode: standalone`) → `'ios-needs-install'`; sem `PushManager` → `'unsupported'`.
  - `subscribeDevice()` com permissão `denied` → retorna `'denied'` e não grava nada; com `granted`, chama `pushManager.subscribe({userVisibleOnly: true, applicationServerKey})` e faz `upsert` em `push_subscriptions` com `onConflict: 'endpoint'` (`endpoint`, `p256dh`, `auth`, `user_agent`).
  - `EnableRemindersCard`: no caso `ios-needs-install`, mostra "Para receber lembretes no iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início." e nenhum botão; no caso `supported` e não inscrito, mostra o botão "Ativar lembretes"; com "Agora não", o card some e fica oculto (`localStorage['organizador-card-lembretes'] = 'oculto'`).
- [ ] **Step 2:** `npm test src/sw-handlers src/lib/push src/ui/EnableRemindersCard`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `sw.ts`: `precacheAndRoute(self.__WB_MANIFEST)`, `NavigationRoute` para `index.html` (exceto `/auth/`), `skipWaiting` + `clientsClaim`, `push` → `showNotification(p.title, notificationOptions(p))`, `notificationclick` → `close()` + `handleNotificationClick`. O app registra o SW com `registerType: 'autoUpdate'`. O card aparece em Hoje só quando não há inscrição neste dispositivo e ele não foi dispensado.
- [ ] **Step 4:** `npm test && npm run build`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: service worker e inscrição de push`.

### Task 9: Edge Functions e cron

**Files:**
- Create: `supabase/functions/_shared/push.ts`, `supabase/functions/_shared/push.test.ts`, `supabase/functions/send-reminders/index.ts`, `supabase/functions/send-test-push/index.ts`, `supabase/functions/delete-account/index.ts`, `supabase/migrations/20261113000003_cron.sql`
- Modify: `supabase/config.toml` (`[functions.send-reminders] verify_jwt = false`)

**Interfaces:**
- Consumes: `claim_due_reminders`, `push_subscriptions`, `PushPayload` (Task 8).
- Produces:
  - `_shared/push.ts`: `buildReminderPayload(item: Item): PushPayload` (`title = item.title`; `body = "01/12 às 14:30 · Profissional"`, ou `"01/12 · Lazer"` se `all_day`, formatado em `item.timezone`; `url = '/?item=<id>'`; `tag = 'item-<id>'`); `sendToUser(admin: SupabaseClient, userId: string, payload: PushPayload, send?: SendFn): Promise<{sent: number; removed: number}>`.
  - Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`), `CRON_SECRET`.
  - Endpoints: `POST /functions/v1/send-reminders` (header `x-cron-secret`), `POST /functions/v1/send-test-push` (JWT do usuário; envia `{title:'Lembretes ativados', body:'Este é um teste do Organizador.', itemId:null, url:'/configuracoes', tag:'teste'}`), `POST /functions/v1/delete-account` (JWT; `auth.admin.deleteUser`, e o cascade apaga os dados).

- [ ] **Step 1: Escrever `push.test.ts` (Deno):** `buildReminderPayload` com o item de 2026-12-01 14:30 em `America/Sao_Paulo`, categoria `work` → body `"01/12 às 14:30 · Profissional"`; all_day `leisure` → `"01/12 · Lazer"`. **Review Focus 3:** `sendToUser` com duas inscrições, cujo `send` mockado rejeita a primeira com `statusCode: 410` → retorna `{sent: 1, removed: 1}` e apaga só o endpoint da primeira.
- [ ] **Step 2:** `npx supabase functions serve` + `deno test supabase/functions/_shared`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `_shared/push.ts` com uma biblioteca de Web Push compatível com Deno (testar primeiro `npm:web-push`; se falhar no runtime das Edge Functions, usar `jsr:@negrel/webpush`). Em `send-reminders`: comparar `x-cron-secret` com `CRON_SECRET` (401 se diferente), chamar `claim_due_reminders(200)` com o client admin e, para cada item, `sendToUser`; responder `{claimed, sent, removed}`. Erros de envio de um item não interrompem os demais.
- [ ] **Step 4: Migração `cron`:** `create extension if not exists pg_cron; create extension if not exists pg_net;` e `cron.schedule('send-reminders', '* * * * *', ...)` com `net.http_post` para `(select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders'`, header `x-cron-secret` vindo de `vault` (`name = 'cron_secret'`). Os segredos do vault são criados no deploy (Task 10), não na migração.
- [ ] **Step 5:** `deno test supabase/functions/_shared`. Esperado: PASS. Teste local de ponta a ponta: com `supabase start` + `functions serve`, inserir um item com `remind_at` vencido e uma inscrição real do navegador (via `npm run dev` apontando para o Supabase local), chamar `send-reminders` com `curl` e ver a notificação chegar.
- [ ] **Step 6:** Commit `feat: envio de lembretes por push`.

### Task 10: Configurações, saída e exclusão de conta

**Files:**
- Create: `src/pages/Settings.tsx`
- Test: `src/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: `useAuth`, `push.ts`, `supabase.functions.invoke('send-test-push' | 'delete-account')`, `clearPersistedCache`.

- [ ] **Step 1: Testes:** mostra o nome e a foto (`user.user_metadata.full_name`, `avatar_url`); status "Lembretes ativos neste dispositivo" / "Lembretes desativados neste dispositivo" / "Este navegador não suporta notificações"; o botão "Enviar notificação de teste" chama `invoke('send-test-push')`; "Desativar neste dispositivo" chama `unsubscribeDevice`; "Sair" chama `unsubscribeDevice` antes de `signOut`; "Excluir conta" abre uma confirmação que exige digitar `EXCLUIR` antes de habilitar o botão final, que chama `invoke('delete-account')`, depois `signOut`, e navega para `/login`.
- [ ] **Step 2:** `npm test src/pages/Settings`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `unsubscribeDevice` apaga a linha (`delete ... where endpoint = ?`) e chama `subscription.unsubscribe()`; uma falha de rede no logout não impede a saída.
- [ ] **Step 4:** `npm test`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: configurações e exclusão de conta`.

### Task 11: Deploy (Supabase, Vercel, Google) e README

Etapas com ação da pessoa estão marcadas com **[pessoa]**. Pare e peça ao usuário quando chegar nelas.

**Files:**
- Create: `README.md`
- Modify: `.env.example` (comentários)

- [ ] **Step 1: Supabase.** Se as ferramentas MCP do Supabase estiverem autorizadas: criar o projeto (região `sa-east-1`) e aplicar as migrações. Senão, **[pessoa]** cria o projeto e roda `npx supabase link` + `npx supabase db push`. Gerar as chaves VAPID (`npx web-push generate-vapid-keys`), rodar `npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:... CRON_SECRET=<aleatório>`, criar os segredos `project_url` e `cron_secret` no vault e fazer `npx supabase functions deploy` das três funções.
- [ ] **Step 2: Vercel.** `npx vercel link` (novo projeto `organizador`), definir as env vars `VITE_*` em production e preview e fazer `npx vercel --prod`. Anotar o domínio `https://<projeto>.vercel.app`.
- [ ] **Step 3: [pessoa] Google Cloud**, guiado pelo README: criar o projeto; configurar a tela de consentimento como "Externo", com nome "Organizador", e-mail de suporte, página inicial = domínio Vercel, política = `<domínio>/privacidade`, domínio autorizado e escopos `openid`, `email`, `profile`; criar o Client ID "Aplicativo da Web" com origem JavaScript = domínio Vercel e URI de redirecionamento = `https://<ref>.supabase.co/auth/v1/callback`; publicar ("Em produção"). Se o Google recusar o domínio `vercel.app` como autorizado, registrar isso no README e avisar o usuário (domínio próprio opcional).
- [ ] **Step 4: Supabase Auth.** Habilitar o provider Google com o Client ID/Secret (**[pessoa]** cola o secret, ou a pessoa informa no painel). Site URL = domínio Vercel; Redirect URLs = domínio Vercel e `http://localhost:5173`.
- [ ] **Step 5: README** em pt-BR: o que é o app, como rodar localmente (`npx supabase start`, `.env.local`, `npm run dev`), o passo a passo das etapas 1–4, o roteiro de teste manual de push (Task 12) e o aviso sobre o iOS (instalar na tela inicial, iOS 16.4+) e sobre a pausa do Supabase Free após 7 dias sem uso.
- [ ] **Step 6:** Commit `docs: README e deploy`.

### Task 12: Verificação de ponta a ponta em produção

- [ ] **Step 1:** Abrir o domínio Vercel no navegador do app: login com Google funciona e volta autenticado; o Lighthouse/DevTools mostra o manifesto válido e o SW ativo.
- [ ] **Step 2:** Criar uma tarefa com lembrete "Na hora" para daqui a 2 minutos, fechar a aba e confirmar que a notificação chega em até ~2 minutos depois do horário, uma única vez. Tocar nela abre o item.
- [ ] **Step 3:** Editar o horário de um item cujo lembrete já foi enviado e confirmar que chega um novo lembrete, só um.
- [ ] **Step 4:** "Enviar notificação de teste" em Configurações chega. Offline (DevTools), o app abre com os dados em cache e o aviso "Sem conexão".
- [ ] **Step 5:** **[pessoa]** Instalar no Android e/ou iPhone (tela inicial), ativar os lembretes e confirmar o recebimento com o app fechado.
- [ ] **Step 6:** Registrar no README o que foi verificado e em quais dispositivos. Commit.
