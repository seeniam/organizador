import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <main className="mx-auto max-w-[65ch] px-6 py-12">
      <Link to="/login" className="text-sm text-muted underline underline-offset-4">
        Voltar
      </Link>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight">Política de privacidade</h1>
      <p className="mt-2 text-sm text-muted">Atualizada em 13 de novembro de 2026.</p>

      <div className="mt-8 space-y-6 leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-semibold">O que guardamos</h2>
          <p className="mt-2">
            Quando você entra com o Google, recebemos seu nome, seu e-mail e sua foto de perfil. Guardamos também as
            tarefas e compromissos que você cria e, se você ativar os lembretes, os dados técnicos que o navegador
            fornece para enviar notificações ao seu aparelho.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold">Para que usamos</h2>
          <p className="mt-2">
            Só para fazer o app funcionar: mostrar seus itens em qualquer dispositivo em que você entrar e enviar os
            lembretes que você pediu. Não vendemos, não compartilhamos e não usamos seus dados para publicidade.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold">Onde ficam</h2>
          <p className="mt-2">
            Os dados ficam armazenados no Supabase, protegidos de forma que cada conta só acessa os próprios itens. O
            app é hospedado na Vercel.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold">Como excluir</h2>
          <p className="mt-2">
            Em Configurações, use “Excluir conta”. Sua conta, seus itens e seus aparelhos cadastrados para lembretes
            são apagados de forma definitiva. Para parar só os lembretes de um aparelho, use “Desativar neste
            dispositivo”.
          </p>
        </section>
      </div>
    </main>
  );
}
