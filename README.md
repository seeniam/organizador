# Organizador

PWA para organizar tarefas e compromissos de **lazer** e **trabalho**, com login pelo Google e lembretes por notificação push que chegam mesmo com o app fechado. Funciona no celular (instalável na tela inicial), no tablet e no desktop.

- **Front:** React + Vite + TypeScript + Tailwind, hospedado na Vercel.
- **Back:** Supabase (login Google, Postgres com RLS, Edge Functions e `pg_cron`).
- **Lembretes:** o banco calcula o horário de cada lembrete. A cada minuto, o `pg_cron` chama a função `send-reminders`, que envia Web Push para todos os aparelhos da pessoa.

## Rodar localmente

Requisitos: Node 20+, Docker Desktop aberto e Deno (só para os testes das funções).

```bash
npm install
npx supabase start
```

Crie um arquivo `.env.local` com os valores que o `supabase start` mostrar:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_VAPID_PUBLIC_KEY=<chave pública VAPID>
```

```bash
npm run dev
```

Sem o Supabase, a página `http://localhost:5173/demo.html` mostra o app com dados de exemplo (só em desenvolvimento).

### Testes

```bash
npm test
```

```bash
npx supabase test db
```

```bash
deno test --allow-env --config supabase/functions/deno.json supabase/functions/_shared
```

## Publicar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com), de preferência na região São Paulo (`sa-east-1`).
2. Vincule e aplique as migrações:
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref <ref-do-projeto>
   ```
   ```bash
   npx supabase db push
   ```
3. Gere as chaves VAPID (o par de chaves dos lembretes):
   ```bash
   npx web-push generate-vapid-keys
   ```
4. Cadastre os segredos das funções (o `CRON_SECRET` pode ser qualquer texto longo e aleatório):
   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=<pública> VAPID_PRIVATE_KEY=<privada> VAPID_SUBJECT=mailto:<seu-email> CRON_SECRET=<texto-aleatório>
   ```
5. Publique as funções:
   ```bash
   npx supabase functions deploy send-reminders --no-verify-jwt
   ```
   ```bash
   npx supabase functions deploy send-test-push
   ```
   ```bash
   npx supabase functions deploy delete-account
   ```
6. No **SQL Editor** do painel, crie os segredos que o cron usa (o mesmo `CRON_SECRET` do passo 4):
   ```sql
   select vault.create_secret('https://<ref-do-projeto>.supabase.co', 'project_url');
   select vault.create_secret('<texto-aleatório>', 'cron_secret');
   ```

### 2. Vercel

```bash
npx vercel link
```

Cadastre as variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_VAPID_PUBLIC_KEY` (em *Settings → Environment Variables*, para Production e Preview) e publique:

```bash
npx vercel --prod
```

Anote o endereço final, por exemplo `https://organizador.vercel.app`.

### 3. Google Cloud (login com Google)

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto.
2. **Tela de consentimento OAuth** (*Google Auth Platform → Branding*):
   - Tipo de usuário: **Externo**.
   - Nome do app: **Organizador**; e-mail de suporte: o seu.
   - Página inicial: o endereço da Vercel.
   - Política de privacidade: `<endereço da Vercel>/privacidade`.
   - Domínios autorizados: o domínio da Vercel e `supabase.co`.
   - Escopos (*Data access*): apenas `openid`, `.../auth/userinfo.email` e `.../auth/userinfo.profile`.
3. **Credenciais → Criar ID do cliente OAuth → Aplicativo da Web**:
   - Origens JavaScript autorizadas: o endereço da Vercel.
   - URIs de redirecionamento autorizados: `https://<ref-do-projeto>.supabase.co/auth/v1/callback`.
   - Guarde o **ID do cliente** e a **chave secreta**.
4. Em *Público-alvo* (*Audience*), clique em **Publicar app** para que qualquer conta Google possa entrar. Com só esses escopos básicos, o Google não exige a revisão completa. Se ele recusar o domínio `vercel.app`, use um domínio próprio (opcional) e repita os passos 2 e 3 com ele.

### 4. Supabase Auth

1. *Authentication → Sign In / Providers → Google*: ative e cole o ID do cliente e a chave secreta.
2. *Authentication → URL Configuration*:
   - Site URL: o endereço da Vercel.
   - Redirect URLs: `<endereço da Vercel>/login` e `http://localhost:5173/login`.

## Avisos

- **iPhone:** os lembretes só funcionam com o app instalado na tela inicial (Compartilhar → Adicionar à Tela de Início), no iOS 16.4 ou mais recente.
- **Supabase gratuito:** o projeto é pausado depois de 7 dias sem uso. Enquanto estiver pausado, os lembretes não saem; ao reativar, os que atrasaram mais de 1 hora são descartados.
- **Limites por conta:** 2.000 itens e 10 aparelhos com lembretes.

## Roteiro de teste manual dos lembretes

1. Entre no app publicado e ative os lembretes (cartão em Hoje ou em Configurações).
2. Em Configurações, toque em **Enviar notificação de teste**; ela deve chegar em segundos.
3. Crie uma tarefa para daqui a 2 minutos com lembrete **Na hora** e feche o app. A notificação deve chegar até cerca de 1 minuto depois do horário, uma única vez.
4. Toque na notificação: o app abre direto no item.
5. Mude o horário de um item cujo lembrete já chegou: deve chegar um novo lembrete, só um.
6. Repita no Android e no iPhone (instalado na tela inicial).
