# DHub

Aplicativo pessoal, mobile-first, para organizar agenda, tarefas, finanças, veículo e lista de mercado em um só lugar.

## O que já funciona

- Dashboard diário com saldo previsto, tarefas, compromissos, carro e mercado.
- Agenda e central de tarefas.
- Salário, renda extra, gastos extras, contas pagas e pendentes.
- Cadastro de veículo, manutenções e abastecimentos.
- Pergunta antes de enviar gastos do carro e do mercado para Finanças.
- Lista de mercado com histórico no banco e sugestões rápidas.
- PWA instalável na tela inicial do celular.
- Lembretes locais ao abrir o aplicativo.
- Modo local automático enquanto o Supabase não estiver conectado.

## 1. Criar o banco

1. Abra o projeto no Supabase.
2. Vá em **SQL Editor > New query**.
3. Cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
4. Clique em **Run**.
5. Vá em **Authentication > Providers > Anonymous** e habilite os acessos anônimos.

O DHub usa sessão anônima: não mostra tela de login, mas cria uma identidade para proteger os dados com RLS. Não limpe os dados do navegador antes de futuramente vincular essa sessão a um e-mail, pois sessões anônimas não podem ser recuperadas após sair, limpar o navegador ou trocar de aparelho.

## 2. Conectar o aplicativo

1. No Supabase, abra **Project Settings / API** ou **Connect**.
2. Copie a **Project URL** e a chave **Publishable**.
3. Crie um arquivo `.env.local` na raiz:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUA_CHAVE
```

Nunca use a chave `service_role` no aplicativo e nunca publique `.env.local`.

## 3. Executar

```bash
npm install
npm run dev
```

Para validar a versão final:

```bash
npm run build
```

## Publicação

O projeto está pronto para publicação na Vercel. Cadastre as duas variáveis de ambiente também no painel da Vercel.

## Observação sobre notificações

A versão atual pede permissão e avisa sobre tarefas do dia quando o DHub é aberto. Notificações confiáveis com o aplicativo totalmente fechado exigirão uma etapa posterior de Web Push.
