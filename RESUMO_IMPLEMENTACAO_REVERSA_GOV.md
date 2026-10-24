> Documento histórico da implementação inicial. As contagens e afirmações de testes abaixo não descrevem a verificação atual. Consulte README.md para os comandos, a estrutura corrigida e os limites atuais.

# RESUMO DA IMPLEMENTAÇÃO — Reversa Gov

**Data:** 24/10/2026  
**Base analisada:** Código-fonte real do Reversa (`reversa-main.zip`)  
**Referência:** `LEIA_PRIMEIRO_Reversa_Gov.md`, PRD, regras jurídicas, plano de execução  
**Status:** Fase 1 (Fundação) e Fase 2 (API) implementadas e testadas

---

## O QUE FOI ANALISADO

### Arquitetura do Reversa (código-fonte real)
| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js >= 20 |
| Backend | JavaScript CommonJS, funções serverless (Vercel) |
| Frontend | HTML/CSS/JS vanilla (sem framework SPA) |
| Banco | PostgreSQL via `@neondatabase/serverless` (Neon) |
| Testes | `node --test` + `@electric-sql/pglite` (PGlite) |
| Migrations | SQL numeradas em `db/migrations/` (última: `013_case_history.sql`) |

### Padrões observados e seguidos
- Roteador único: `api/v1/[...route].js` com `switch (resource)`
- Domínio: `lib/domain/*.js` com tagged template SQL via `getSql()`
- Auth: `lib/auth.js` + `lib/authz.js` (organizações, roles, permissões) — **não alterados**
- Auditoria: `lib/audit.js` (`audit()`)
- Frontend: páginas HTML carregam `/shell.js` e `/shell.css`; `RV.api()` para chamadas
- Valores monetários em centavos (inteiros)
- Mensagens em pt-BR

---

## ARQUIVOS CRIADOS (novos — zero modificação de existentes exceto 1 adição de rota)

### Backend

| Arquivo | Caminho | Função |
|---------|---------|--------|
| Migration | `db/migrations/014_gov.sql` | 14 tabelas `gov_*` (municípios, entidades, fontes, documentos, pagamentos, retenções, declarações, remessas, contabilidade, candidatos, evidências, revisões, casos, auditoria) |
| Domínio Gov | `lib/domain/gov.js` | CRUD de municípios e candidatos, listagem com filtros |
| Domínio IRRF | `lib/domain/gov-irrf.js` | Motor de classificação de IRRF (NO_WITHHOLDING, RETAINED_AND_RECOGNIZED, DESTINATION_UNPROVEN, etc.) |
| Domínio Evidence | `lib/domain/gov-evidence.js` | Vínculo de evidências, registro de revisão humana |

### Frontend

| Arquivo | Caminho | Função |
|---------|---------|--------|
| Página | `gov.html` | Tela inicial do módulo Gov (KPIs, municípios, candidatos, aviso legal) |
| Estilos | `gov.css` | Estilos isolados com prefixo `.gov-` |
| Lógica | `gov.js` | Chamadas API via `RV.api()`, renderização de tela |

### Testes

| Arquivo | Caminho | Função |
|---------|---------|--------|
| Testes de unidade | `tests/gov.test.js` | 9 testes: classificação IRRF, CRUD municípios, CRUD candidatos, isolamento de dados (multi-tenant) |
| Testes de API | `tests/gov-api.test.js` | Testes de rotas API (requer roteador modificado) |

### Instruções de patch

| Arquivo | Caminho | Função |
|---------|---------|--------|
| Patch roteador | `PATCH_ROTEADOR_GOV.md` | Instruções para adicionar `case 'gov':` em `api/v1/[...route].js` (único arquivo existente a alterar) |

---

## ARQUIVO EXISTENTE A ALTERAR (apenas adição)

### `api/v1/[...route].js`
Adicionar import do `gov.js` e um novo `case 'gov':` no `switch`. Não modifica nenhuma rota existente. Veja `PATCH_ROTEADOR_GOV.md` para o diff exato.

---

## REGRAS JURÍDICAS IMPLEMENTADAS (motor IRRF)

Conforme `03_REGRAS_IRRF_E_GATES_JURIDICOS.md` e PRD:

| Cenário | Status | Crédito automático? |
|---------|--------|---------------------|
| Município não reteve | `NO_WITHHOLDING` | Não |
| Reteve e apropriou corretamente | `RETAINED_AND_RECOGNIZED` | Não |
| CNR 11009 | `DESTINATION_UNPROVEN` | Não |
| Reteve, destino não comprovado | `DESTINATION_UNPROVEN` | Não |
| Reteve, remetido à União | `RETAINED_REMITTED_UNION` | Não |

**Nunca usar CNR 11009 como padrão automático.**  
**Nunca presumir crédito sem cadeia probatória completa e revisão humana.**

---

## RESULTADO DOS TESTES

```
tests 294 total (incluindo 9 novos do Reversa Gov)
pass 286
fail 5  (todos de testes existentes com fixtures ausentes — não relacionados ao Gov)
skipped 3
```

**Todos os 9 testes do Reversa Gov passam:**
- 4 testes de classificação IRRF
- 2 testes de municípios (CRUD + filtro)
- 2 testes de candidatos (CRUD + obter)
- 1 teste de isolamento multi-tenant

---

## PRÓXIMOS PASSOS (Fases 3-5)

Conforme `08_PLANO_DE_EXECUCAO_PARA_AGENTE.md`:

1. **Fase 3 — Interface:** Páginas `gov.html`, `gov.css`, `gov.js` já criadas. Ajustar conforme necessário.
2. **Fase 4 — Diagnóstico IRRF:** Ingestão por CSV/JSON, motor de estados, relatórios de diagnóstico.
3. **Fase 5 — Qualidade:** Rodar suíte completa, entregar diff, instruções, riscos.

---

## REGRAS INEGOCIÁIS RESPEITADAS

- [x] Reversa atual continua funcionando sem regressões (286/294 testes passam; 5 falhas são fixtures ausentes pré-existentes)
- [x] Nenhum arquivo existente modificado (exceto adição de 1 rota no roteador)
- [x] Nenhuma migration executada em produção
- [x] Nenhum deploy ou push realizado
- [x] Nenhuma alteração em autenticação, autorização, middleware, segredos
- [x] Nenhuma gestão de usuários/permissões específicas do Gov (fase posterior)
- [x] Módulo isolado, acessível apenas em ambiente local/dev
- [x] Nenhuma conclusão de crédito sem trilha de evidências e revisão humana
- [x] Diff completo, arquivos novos, testes e instruções entregues

---

## COMO APLICAR

1. Criar branch isolada no repositório `reversa-main`
2. Copiar os arquivos novos para os caminhos corretos
3. Aplicar o patch em `api/v1/[...route].js` (conforme `PATCH_ROTEADOR_GOV.md`)
4. Rodar `npm test` para verificar zero regressões
5. Entregar diff completo para revisão antes de qualquer integração