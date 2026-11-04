# Agenda+ — Estado do backend Supabase

Auditoria em 04/11/2026. Projeto existente: `wpgwopmfvthrxuzilxdw`.

## Implantado no Supabase

Migração aplicada: `create_agendaplus_profiles_with_rls`.

Tabela `public.profiles`:
- `id uuid` (PK, referenciada em `auth.users(id)` com ON DELETE CASCADE)
- `full_name text` (obrigatório, 2–120 caracteres sem contar espaços nas bordas)
- `phone text` (opcional)
- `account_type text` (obrigatório: `cliente` ou `empresa`)
- `created_at timestamptz`, `updated_at timestamptz`

RLS está ativo. Políticas exclusivas para usuários autenticados:
- `profile_select_own`: ler o próprio perfil
- `profile_insert_own`: inserir perfil com `id = auth.uid()`
- `profile_update_own`: atualizar apenas o próprio perfil, sem trocar o proprietário

O papel `anon` não recebe leitura; `authenticated` só pode inserir colunas de identificação/perfil e atualizar `full_name`, `phone` e `updated_at`. `account_type` não pode ser alterado por UPDATE pelo cliente. Ele **não substitui** checagens de propriedade da empresa em políticas futuras.

Verificação pós-migração: RLS habilitado, três políticas encontradas, `anon_can_select = false`; Security Advisor e Performance Advisor sem avisos.

## Ainda não implantado

- Integração do SDK no aplicativo e configuração de persistência de sessão
- Fluxos de cadastro, confirmação de e-mail, login e logout
- Rotas protegidas e tratamento de falhas
- Entidades de empresas, serviços e agendamentos; suas políticas de autorização
- Testes end-to-end em Expo Web/Android
- Exportação/versionamento do schema no repositório via Supabase CLI (usar `supabase db pull` em ambiente configurado)
- Sincronização dos arquivos mais recentes do Codespaces com GitHub

**Importante:** a criação da tabela não cria contas em `auth.users` nem insere linhas em `profiles`. O cliente deverá criar o perfil apenas quando estiver autenticado; com confirmação de e-mail ativa, é possível que `signUp` não devolva uma sessão.

Configuração de ambiente planejada (não armazene segredos no Git):
```
EXPO_PUBLIC_SUPABASE_URL=https://wpgwopmfvthrxuzilxdw.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<obtenha no Dashboard / API Keys>
```
Nunca use `service_role` ou `sb_secret_` no Expo.

Referências:
- https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
