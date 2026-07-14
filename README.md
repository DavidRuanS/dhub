# DHub

Site pessoal mobile-first para agenda, tarefas, finanças, veículo e lista de mercado.

## Link previsto

Depois de habilitar o GitHub Pages e a publicação terminar:

`https://davidruans.github.io/dhub/`

Não é necessário instalar nada. Basta abrir o link no celular ou computador.

## Banco Supabase

1. Abra **SQL Editor > New query**.
2. Cole e execute todo o arquivo `supabase/schema.sql`.
3. Abra **Authentication > Providers > Anonymous** e habilite o acesso anônimo.
4. Copie somente a **Project URL** e a **Publishable Key**.

Nunca envie a senha do banco, `service_role` ou `secret key`.

## Publicação no GitHub Pages

Em **Settings > Pages**, selecione **GitHub Actions** como fonte. O workflow `.github/workflows/deploy.yml` publica o site automaticamente a cada atualização da branch `main`.

As variáveis utilizadas pela publicação são:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
