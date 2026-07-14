# DHub

Aplicativo pessoal mobile-first para organizar agenda, tarefas, finanças, veículo e lista de mercado.

## Recursos da primeira versão

- Dashboard com saldo previsto, tarefas, agenda, mercado e veículo.
- Salário, renda extra, gasto extra, despesas pagas e pendentes.
- Manutenções e abastecimentos com pergunta antes de registrar em Finanças.
- Lista de mercado com opção de não registrar o valor quando outra pessoa pagar.
- PWA instalável no celular e lembretes locais.
- Modo local antes da conexão com o Supabase.

## Configurar o Supabase

1. Abra **SQL Editor > New query**.
2. Cole e execute `supabase/schema.sql`.
3. Abra **Authentication > Providers > Anonymous** e habilite o acesso anônimo.
4. Copie a Project URL e a chave Publishable.
5. Crie `.env.local` usando `.env.example` como modelo.

A sessão anônima evita uma tela de login e permite proteger os dados com RLS. Como ela pertence ao navegador, não limpe os dados do site nem troque de aparelho antes de futuramente vincular a sessão a um e-mail.

## Executar

```bash
npm install
npm run dev
```

## Validar

```bash
npm run build
```

## Publicar

Importe o repositório na Vercel e cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente.
