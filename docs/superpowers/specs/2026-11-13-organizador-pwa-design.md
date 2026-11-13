# Organizador de tarefas e compromissos (PWA): desenho

Data: 2026-11-13

## Intenção

Um organizador pessoal, aberto a qualquer pessoa com conta Google (cada uma vê só os próprios dados), instalável no celular como PWA e que também funcione bem em tablet e desktop. Nele a pessoa registra **tarefas** (coisas a fazer) e **compromissos** (com data e hora), separados entre **lazer** e **profissional**. O app manda **notificações push** de lembrete, que chegam mesmo com o app fechado, e o login é feito com a **conta Google**, com os dados sincronizados entre dispositivos.

## Objetivos

- Mobile first, com layout próprio para tablet e desktop.
- Instalável (manifesto, ícones, service worker) em Android, iOS e desktop.
- Login só com Google, aberto a qualquer conta Google (decisão da pessoa). Os dados ficam na nuvem, isolados por usuário.
- Lembretes por Web Push disparados pelo servidor, sem depender do app aberto.
- Rodar inteiro em planos gratuitos, sem cartão de crédito.

## Fora do escopo (primeira versão)

- Integração com Google Agenda (pode vir depois; o login com Google já facilita).
- Tarefas recorrentes, subtarefas, anexos, compartilhamento com outras pessoas.
- Criar e editar itens offline.
- Outros métodos de login (e-mail/senha etc.).
- Idiomas além de português do Brasil.

## Antiobjetivos (seria um fracasso mesmo funcionando)

- Lembrete que não chega ou chega atrasado (mais de cerca de 2 minutos) com o app fechado.
- Lembrete duplicado para o mesmo item.
- Um usuário enxergar dados de outro.
- Pedir permissão de notificação logo ao abrir o app, sem contexto.
- Layout de celular apenas esticado no desktop.

## Restrições

- **iOS:** push só funciona com o PWA instalado na tela inicial (iOS 16.4+). O app precisa detectar quando não está instalado no iOS e explicar como instalar antes de oferecer notificações.
- **Planos gratuitos:** Supabase Free (projeto pausa após 7 dias sem uso; uso diário evita isso) e Vercel Hobby.
- Credencial OAuth do Google criada pela pessoa no Google Cloud Console (o builder deve fornecer o passo a passo, com as URLs de redirecionamento exatas).
- **Login aberto ao público:** a tela de consentimento do Google precisa ser publicada ("Em produção"). Ela usa só os escopos básicos (`openid`, `email`, `profile`), que não exigem a revisão completa do Google. Para publicar, o Google pede link para a página inicial e para uma política de privacidade, então o app terá uma página pública `/privacidade`. Se o Google exigir domínio verificado (o `*.vercel.app` pode não servir), o builder deve sinalizar isso; um domínio próprio fica como passo opcional no README.
- **Proteção da cota gratuita** (decisão do Claude): limites por usuário aplicados no banco, de no máximo 2.000 itens e 10 inscrições de push.
- O projeto fica em `C:\Users\neemi\organizador`, separado do repositório do Pulso Quiz.

## Abordagens consideradas

| Abordagem | Prós | Contras |
|---|---|---|
| **A. Supabase + Vercel (escolhida)** | Login Google, Postgres com RLS, Edge Functions e pg_cron no plano grátis; front estático na Vercel | Exige criar credencial OAuth no Google Cloud |
| B. Firebase | Login, banco e FCM no mesmo lugar | Agendamento (Cloud Functions/Scheduler) exige plano Blaze com cartão |
| C. Servidor Node no Render | Mesmo padrão do Pulso Quiz | No plano grátis o servidor dorme, e os lembretes não disparam |

Escolhida pela pessoa: **A**, com credencial OAuth no Google Cloud.

## Decisões de como construir

### Stack (decisão do Claude)

- React + Vite + TypeScript.
- `vite-plugin-pwa` no modo `injectManifest`, com service worker próprio para tratar os eventos `push` e `notificationclick`, além do cache do shell do app.
- Tailwind CSS para o estilo; `date-fns` com locale `pt-BR`.
- `@supabase/supabase-js` para login e dados; TanStack Query para busca e cache, com persistência local (IndexedDB ou localStorage) para mostrar os últimos dados offline.
- Hospedagem: Vercel (site estático com fallback de SPA para `index.html`).

### Modelo de dados

**`items`**

| coluna | tipo | observação |
|---|---|---|
| id | uuid pk | |
| user_id | uuid → auth.users | default `auth.uid()` |
| kind | text | `'task'` ou `'event'` |
| category | text | `'leisure'` ou `'work'` |
| title | text | obrigatório |
| notes | text | opcional |
| starts_at | timestamptz | obrigatório para `event`, opcional para `task` (prazo) |
| ends_at | timestamptz | opcional, só `event`, deve ser maior que `starts_at` |
| all_day | boolean | default false; tarefa só com data e sem hora = true |
| reminder_minutes | int | null = sem lembrete; valores: 0, 10, 60, 1440 |
| remind_at | timestamptz | calculado por trigger: `starts_at - reminder_minutes`; null quando não houver lembrete ou data |
| reminder_sent_at | timestamptz | null até enviar |
| done_at | timestamptz | só para `task`; null = pendente. Compromissos não são concluídos (decisão da pessoa) |
| created_at, updated_at | timestamptz | |

- Item `all_day`: o lembrete é calculado a partir das 09:00 no fuso do usuário naquele dia. Para isso a tabela guarda também `timezone text` (IANA, enviado pelo cliente ao salvar).
- Trigger: ao mudar `starts_at`, `reminder_minutes` ou `all_day`, recalcula `remind_at` e zera `reminder_sent_at`.
- Concluir uma tarefa cancela o lembrete pendente (a função de envio ignora itens com `done_at`).
- Índice parcial em `remind_at` onde `reminder_sent_at is null and done_at is null`.

**`push_subscriptions`**: id, user_id, endpoint (único), p256dh, auth, user_agent, created_at. Um usuário pode ter várias (celular, desktop...).

**RLS:** nas duas tabelas, cada usuário só lê e escreve as próprias linhas (`user_id = auth.uid()`). A função de envio usa a service role.

### Disparo dos lembretes

1. `pg_cron` roda a cada minuto e chama, via `pg_net`, a Edge Function `send-reminders`, protegida por um segredo compartilhado.
2. A função seleciona, com trava contra concorrência (por exemplo `UPDATE ... SET reminder_sent_at = now() WHERE ... RETURNING`, ou `FOR UPDATE SKIP LOCKED`), os itens com `remind_at <= now()`, `reminder_sent_at is null` e `done_at is null`. Assim ninguém recebe duplicado se duas execuções se sobrepuserem.
3. Para cada item, envia Web Push (VAPID) a todas as inscrições do usuário. A carga leva título, horário formatado e categoria, e o `id` do item.
4. Inscrições que retornarem 404/410 são apagadas.
5. Lembretes que ficaram atrasados mais de 1 hora (projeto pausado, por exemplo) são marcados como enviados sem notificar.
- Biblioteca de Web Push compatível com Deno: o builder escolhe e verifica (`npm:web-push` ou alternativa JSR).
- Chave VAPID pública no front (`VITE_VAPID_PUBLIC_KEY`); a privada fica só nos secrets do Supabase.

### Notificações no cliente

- A permissão é pedida só por ação explícita: um cartão "Ativar lembretes" depois do primeiro login e uma opção em Configurações.
- No iOS fora do modo instalado, o cartão mostra as instruções de instalação ("Compartilhar → Adicionar à Tela de Início") no lugar do botão.
- Ao tocar na notificação, o app abre (ou foca) e mostra o item.
- Configurações listam o status das notificações neste dispositivo, com botão de "enviar notificação de teste" (via Edge Function) e opção de desativar neste dispositivo.
- Ao sair da conta, a inscrição deste dispositivo é removida.

### Telas

- **Login:** marca do app, o botão "Entrar com Google" e link para a política de privacidade.
- **Regra de compromissos (decisão da pessoa):** compromissos não têm círculo de concluir nem gesto de concluir e nunca ficam "atrasados". Quando o horário passa (`ends_at`, ou `starts_at` se não houver fim), eles saem das listas ativas e vão para o Histórico. *Decisão do Claude:* compromissos de hoje que já passaram continuam em Hoje, esmaecidos, até o fim do dia, e só então vão para o Histórico.
- **Hoje:** tarefas atrasadas (destacadas), tarefas e compromissos de hoje, ordenados por horário; tarefas sem data aparecem numa seção "Sem data".
- **Próximos:** itens futuros agrupados por dia.
- **Calendário:** grade do mês com indicadores por dia, nas cores das categorias; ao tocar no dia, abre a lista daquele dia (incluindo itens passados).
- **Histórico:** tarefas concluídas (com opção de desfazer) e compromissos que já passaram, agrupados por dia, do mais recente para o mais antigo.
- **Política de privacidade:** página pública e estática.
- **Filtro global:** Todos / Lazer / Profissional, presente em todas as listas e mantido entre telas.
- **Criar/editar:** botão flutuante "+". No celular abre uma folha que sobe de baixo; no tablet e desktop, um painel lateral ou modal. Campos: título, tipo (tarefa ou compromisso), categoria, data, hora (e hora de fim, para compromisso), "dia inteiro", lembrete e anotação. Também dá para excluir o item.
- **Interações rápidas:** em tarefas, marcar como concluída com toque no círculo; no celular, deslizar para concluir (só tarefas) ou excluir (qualquer item), com desfazer.
- **Configurações:** além do que está abaixo, opção de excluir a conta e todos os dados (exigida por ser um app público).
- **Configurações:** conta (nome e foto do Google), notificações, sair.

### Layout responsivo

- **Celular (< 768px):** barra de navegação inferior (Hoje, Próximos, Calendário, Histórico) e botão flutuante.
- **Tablet (768–1199px):** menu lateral recolhido em ícones; listas mais largas.
- **Desktop (≥ 1200px):** menu lateral completo; calendário e lista lado a lado; edição em painel lateral.
- Cores distintas para lazer e profissional, usadas de forma consistente; tema claro e escuro conforme o sistema. A direção visual será definida na implementação, com a skill de frontend-design.

### Offline

- O shell do app fica em cache, e o app abre sem internet.
- Os últimos dados carregados aparecem com um aviso "Sem conexão".
- Criar, editar e concluir ficam desabilitados offline, com mensagem clara.

### Testes (decisão do Claude)

- Vitest para a lógica pura: cálculo de `remind_at`, agrupamento por dia, filtros e fuso horário.
- Testes das políticas RLS e do trigger em SQL.
- Teste manual guiado do push em Android, desktop e iOS instalado, documentado no README.

### Configuração e deploy

- Variáveis no front: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
- Secrets do Supabase: chave VAPID privada, assunto VAPID (`mailto:`), segredo do cron.
- Migrações SQL versionadas em `supabase/migrations`.
- O README traz o passo a passo: criar o projeto Supabase, criar a credencial OAuth no Google Cloud (tela de consentimento + client ID web, com a URL de callback do Supabase), habilitar o provider Google no Supabase, configurar as URLs de redirecionamento (localhost e domínio da Vercel), gerar as chaves VAPID e fazer o deploy na Vercel.
- Se o plugin do Supabase for autorizado (`/mcp`), o Claude cria o projeto e aplica as migrações; caso contrário, a pessoa segue o README.
- Deploy (decisão do Claude): o Claude cria o projeto na Vercel e faz o deploy pela CLI ou plugin da Vercel, como uma tarefa do plano. Um remoto no GitHub é opcional e pode ser ligado depois. O primeiro deploy acontece antes da etapa do Google Cloud, para que o domínio `*.vercel.app` já exista quando as URLs de redirecionamento forem cadastradas no Google e no Supabase.

## Deixado para o builder

- Estrutura de pastas e componentes.
- Biblioteca de Web Push no Deno.
- Biblioteca de gestos para deslizar.
- Ícones e paleta exata, dentro das regras acima.
