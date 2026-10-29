# Agenda+ — Auditoria técnica inicial

## Estado verificado

- [x] Repositório acessível: `Isadora-gularte/AgendaPro`
- [x] Branch principal: `main`
- [x] Permissão de escrita confirmada
- [x] Supabase conectado e saudável
- [x] PostgreSQL 17 ativo
- [x] Security Advisor sem alertas
- [x] Performance Advisor sem alertas
- [x] Schema `public` sem tabelas
- [x] Nenhum usuário cadastrado no Auth
- [x] Nenhuma Edge Function
- [x] Nenhum branch Supabase
- [x] CI criado em branch isolada
- [x] `npm ci`, Expo dependency check, lint e TypeScript passaram no CI

## Problemas encontrados

- [ ] O GitHub está atrasado em relação ao código testado no Codespaces.
- [ ] `login.tsx` e `cadastro.tsx` não existem no `main` atual.
- [ ] A tela inicial ainda usa `console.log` nos botões em vez de navegação.
- [ ] Existe um arquivo chamado literalmente `app/tipo-usuario.tsx ` com espaço no final.
- [ ] Esse arquivo importa `../constants/colors`, mas a pasta `constants` não existe no commit atual.
- [ ] O `app.json` ainda usa `meu-primeiro-app` como nome/slug/scheme.
- [x] `.env` agora está protegido na branch de auditoria.
- [x] `.env.example` foi adicionado sem segredos.

## Segurança Supabase

- [x] Usar apenas publishable key no cliente Expo.
- [ ] Nunca usar `service_role` no aplicativo.
- [ ] Criar tabelas somente com RLS habilitado.
- [ ] Criar policies de ownership por `auth.uid()`.
- [ ] Evitar usar `user_metadata` como fonte de autorização.
- [ ] Revisar autenticação por e-mail antes de produção.

## Integração pendente

- [ ] Sincronizar o código mais recente do Codespaces com o GitHub.
- [ ] Instalar `@supabase/supabase-js` e dependências necessárias na versão compatível com Expo 54.
- [ ] Criar cliente Supabase em arquivo dedicado.
- [ ] Conectar cadastro real ao Supabase Auth.
- [ ] Conectar login real ao Supabase Auth.
- [ ] Implementar persistência de sessão.
- [ ] Criar tabela `profiles` com RLS.
- [ ] Salvar tipo de conta (`cliente` / `empresa`) de forma segura.
- [ ] Proteger rotas autenticadas.
- [ ] Testar cadastro → confirmação/login → sessão → logout.
- [ ] Criar migrations versionadas no repositório.
- [ ] Rodar Advisors novamente após alterações de banco.

## Branch de trabalho

`audit/supabase-integration`

As alterações desta auditoria não devem ser mescladas no `main` até que o código mais recente do Codespaces esteja sincronizado e revisado.
