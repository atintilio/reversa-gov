# PLANO DE IMPLEMENTAÇÃO — Reversa Gov

**Produto:** Reversa Gov (módulo IRRF Municipal)  
**Plataforma:** Reversa Tax (Argus Prime)  
**Base:** Código-fonte real em `/tmp/opencode/reversa_source/reversa-main/reversa-main/`  
**Referência:** `LEIA_PRIMEIRO_Reversa_Gov.md`, `00_LEIA_PRIMEIRO.md`, `08_PLANO_DE_EXECUCAO_PARA_AGENTE.md`  
**Status:** Plano de implementação — Fase 0 (Reconhecimento) concluída

---

## 1. ANÁLISE DO CÓDIGO-FONTE (baseline)

### Stack confirmada
| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js >= 20 |
| Backend | JavaScript CommonJS, funções serverless (Vercel) |
| Frontend | HTML/CSS/JS vanilla (sem framework SPA) |
| Banco | PostgreSQL via `@neondatabase/serverless` (Neon) |
| Testes | `node --test tests/*.test.js` + `@electric-sql/pglite` |
| Migrations | SQL numeradas em `db/migrations/` (última: `013_case_history.sql`) |
| Deploy | Vercel (`vercel.json` com rewrites para `/api/v1/rota`) |

### Estrutura de diretórios (raiz do `reversa-main/`)
```
api/v1/[...route].js     <- roteador único (todas as rotas /api/v1/*)
api/v1/rota.js           <- ponte para [...route].js
lib/db.js                <- acesso ao banco (tagged template Neon)
lib/auth.js              <- autenticação (sessões, cookies)
lib/authz.js             <- autorização (organizações, roles, permissões)
lib/http.js              <- utilitários HTTP (parseBody, json, redirect)
lib/audit.js             <- trilha de auditoria (audit_events)
lib/domain/*.js          <- serviços de domínio (diagnosticos, crm, tax, etc.)
lib/domain/tax.js        <- exemplo de domínio com cases, analyses, etc.
db/migrations/001_...sql <- migrations SQL numeradas (001 a 013)
tests/*.test.js          <- testes com node:test
tests/helpers.js         <- helpers de teste (PGlite, call, freshRequire)
shell.js                 <- UI compartilhado (navegação, RV.api, utilitários)
shell.css                <- estilos comuns (variáveis CSS, componentes)
*.html                   <- páginas individuais (dashboard, clientes, etc.)
```

### Padrões de código a seguir

**API (roteador):**
- Todas as rotas vão em `api/v1/[...route].js` via `switch (resource)`
- Cada case recebe `ctx` do `context(req)` (autenticação + organização + role)
- `deny(ctx, permissao, ação)` para controle de acesso
- Resposta via `json(res, status, body)` de `lib/http.js`
- Auditoria via `audit('tipo', {...})` de `lib/audit.js`

**Domínio:**
- Arquivos em `lib/domain/*.js`, exportando funções que recebem `ctx` e parâmetros
- Consultas SQL via tagged template `getSql()` de `lib/db.js`
- Valores monetários em **centavos (inteiros)**
- Mensagens em pt-BR

**Banco:**
- Migrations incrementais com número após `013`
- Tabelas com `id uuid primary key default gen_random_uuid()`
- `organization_id` em todas as tabelas multi-tenant
- `created_at timestamptz not null default now()`
- Constraints de CHECK para status/enums
- Índices em colunas de consulta frequente

**Frontend:**
- Cada página HTML carrega `/shell.js` e `/shell.css`
- `RV.api(metodo, url, corpo)` para chamadas fetch (automaticamente redireciona para `/login.html` em 401)
- `RV.usuario` populado após `fetch('/api/v1/me')`
- CSS com variáveis (`--navy`, `--teal`, `--card`, etc.)
- Padrão `.rv main { max-width: 1240px; ... }`, `.rv .card`, `.rv .kpi`, `.rv table`

**Testes:**
- `tests/helpers.js` exporta `createDb()`, `freshRequire()`, `call()`, `cookieFrom()`
- Testes rodam com `npm test` (`node --test tests/*.test.js`)
- Banco de teste em memória (PGlite) com todas as migrations aplicadas

### Última migration: `013_case_history.sql`
Próximo número livre para migration Gov: **`014_gov.sql`**

---

## 2. PRINCÍPIOS INEGOCIÁIS (do LEIA_PRIMEIRO)

1. Trabalhar em cópia/branch isolada
2. Registrar `git status`/hash dos arquivos originais antes de editar
3. **Não alterar nem renomear** arquivos, rotas, tabelas, componentes ou comportamentos existentes
4. Não executar migrations, seeds, deploy ou operações contra banco/produção
5. Não alterar `.env`, segredos, autenticação, middleware ou permissões atuais
6. Não implementar gestão de usuários/permissões específicas do Gov agora (fase posterior)
7. Manter o módulo isolado, acessível apenas em ambiente local/dev
8. Entregar diff completo, arquivos novos, testes, instruções e lista de arquivos alterados
9. Se houver conflito entre o pacote e o código real, parar e sinalizar

---

## 3. PLANO DE IMPLEMENTAÇÃO POR FASES

### Fase 0 — Reconhecimento (CONCLUÍDA)
- [x] Ler `package.json`, `vercel.json`, roteador, migrations, `shell.js`, CSS, testes/helpers
- [x] Mapear padrão real de rotas e consultas
- [x] Analisar documentos técnicos do Reversa Gov
- [x] Produzir este plano de implementação

### Fase 1 — Fundação isolada
- [ ] Criar migration `db/migrations/014_gov.sql` com tabelas `gov_*`
- [ ] Criar `lib/domain/gov.js` — casos de uso, consultas e validações de domínio
- [ ] Criar `lib/domain/gov-irrf.js` — classificação e análise da cadeia de IRRF
- [ ] Criar `lib/domain/gov-evidence.js` — evidências, vínculos e status de comprovação
- [ ] Criar `tests/gov.test.js` — testes de unidade do domínio
- [ ] Validar migration apenas em banco de teste (PGlite)
- [ ] Rodar suíte de testes existente para garantir zero regressões

### Fase 2 — API
- [ ] Adicionar case `gov` no roteador `api/v1/[...route].js` (adição, não modificação de rotas existentes)
- [ ] Implementar rotas:
  - `GET /api/v1/gov/dashboard`
  - `GET|POST /api/v1/gov/municipios`
  - `GET|PATCH /api/v1/gov/municipios/:id`
  - `GET|POST /api/v1/gov/fontes`
  - `POST /api/v1/gov/ingestoes`
  - `GET /api/v1/gov/ingestoes/:id`
  - `GET /api/v1/gov/candidatos`
  - `GET /api/v1/gov/candidatos/:id`
  - `POST /api/v1/gov/candidatos/:id/revisao`
  - `GET|POST /api/v1/gov/casos`
  - `GET /api/v1/gov/casos/:id`
  - `GET /api/v1/gov/casos/:id/relatorio`
- [ ] Reutilizar autenticação global existente (`context()`, `authz`)
- [ ] Não criar endpoints de transmissão fiscal ou protocolo automático
- [ ] Criar `tests/gov-api.test.js` — testes de API

### Fase 3 — Interface
- [ ] Criar `gov.html` — página inicial do módulo Gov
- [ ] Criar `gov.js` — chamadas API e estado de tela
- [ ] Criar `gov.css` — estilos isolados com prefixo `.gov-`
- [ ] Opcional: `gov-municipio.html` e `gov-caso.html`
- [ ] Reutilizar shell e padrões visuais do Reversa
- [ ] Entrada Gov apenas em ambiente local/dev (flag de ambiente, sem bypass de autenticação)
- [ ] Não mexer no menu global de produção nesta fase

### Fase 4 — Diagnóstico IRRF
- [ ] Ingestão inicial por CSV/JSON/arquivos de exemplo sintéticos
- [ ] Motor de estados e evidências conforme `03_REGRAS_IRRF_E_GATES_JURIDICOS.md`
- [ ] Exibir lacunas, nunca preencher com suposições
- [ ] Relatórios de diagnóstico com valores estimados separados dos validados
- [ ] Não usar CNR 11009 como padrão automático

### Fase 5 — Qualidade e entrega
- [ ] Rodar suíte completa de testes
- [ ] Entregar diff completo, lista de arquivos, instruções de execução e riscos
- [ ] Apresentar screenshots das telas
- [ ] Informar explicitamente o que não foi implementado
- [ ] Não fazer deploy nem push

---

## 4. ARQUIVOS A CRIAR (novos)

### 4.1 Backend — Migration

**`db/migrations/014_gov.sql`**

```sql
-- 014 — Módulo Reversa Gov: IRRF Municipal (isolado, aditivo, sem modificar tabelas existentes)
-- Prefixo obrigatório gov_ para isolamento lógico

create table if not exists gov_municipalities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  ibge_code char(7) not null,
  name varchar(240) not null,
  state char(2) not null,
  cnpj_root char(8),
  status varchar(30) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gov_municipalities_status_ck check (status in ('active', 'suspended', 'archived')),
  constraint gov_municipalities_ibge_uq unique (ibge_code)
);

create index if not exists gov_municipalities_org_idx on gov_municipalities (organization_id, state);

create table if not exists gov_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  municipality_id uuid not null references gov_municipalities(id),
  cnpj char(14) not null,
  legal_name varchar(240) not null,
  legal_nature_code varchar(20),
  entity_type varchar(40) not null check (entity_type in ('direct_admin', 'autarchy', 'foundation', 'consortium', 'other')),
  is_active boolean not null default true,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gov_entities_cnpj_uq unique (cnpj)
);

create index if not exists gov_entities_municipality_idx on gov_entities (municipality_id);
create index if not exists gov_entities_org_idx on gov_entities (organization_id);

create table if not exists gov_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name varchar(180) not null,
  source_type varchar(40) not null check (source_type in ('transparency_portal', 'tce', 'pncp', 'siconfi', 'official_gazette', 'upload')),
  base_url text,
  terms_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists gov_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_id uuid references gov_entities(id),
  original_name varchar(255) not null,
  mime_type varchar(120) not null,
  size_bytes bigint not null,
  checksum_sha256 varchar(64) not null,
  classification varchar(40) not null default 'internal' check (classification in ('public', 'internal', 'confidential', 'fiscal_restricted', 'personal_data')),
  period_start date,
  period_end date,
  received_at timestamptz not null default now(),
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists gov_documents_org_idx on gov_documents (organization_id, received_at desc);

create table if not exists gov_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_id uuid not null references gov_entities(id),
  supplier_cnpj char(14),
  supplier_name varchar(240),
  invoice_id varchar(120),
  empenho_id varchar(120),
  liquidation_id varchar(120),
  payment_date date,
  competence date,
  gross_amount_cents bigint not null default 0,
  net_amount_cents bigint not null default 0,
  currency char(3) not null default 'BRL',
  source_document_id uuid references gov_documents(id),
  source_locator text,
  created_at timestamptz not null default now()
);

create index if not exists gov_payments_entity_idx on gov_payments (entity_id, payment_date);
create index if not exists gov_payments_supplier_idx on gov_payments (organization_id, supplier_cnpj);

create table if not exists gov_withholdings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  payment_id uuid not null references gov_payments(id),
  tax_type varchar(40) not null default 'IRRF',
  tax_base_cents bigint not null default 0,
  rate numeric(9,6),
  withheld_amount_cents bigint not null default 0,
  withholding_date date,
  nature_code varchar(30),
  cnr varchar(20),
  legal_owner varchar(20) not null default 'UNKNOWN' check (legal_owner in ('MUNICIPAL', 'FEDERAL', 'UNKNOWN')),
  source_document_id uuid references gov_documents(id),
  created_at timestamptz not null default now()
);

create index if not exists gov_withholdings_payment_idx on gov_withholdings (payment_id);

create table if not exists gov_declarations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_id uuid not null references gov_entities(id),
  period date not null,
  system_name varchar(120) not null,
  event_type varchar(80),
  receipt_id varchar(120),
  cnr varchar(20),
  declared_amount_cents bigint not null default 0,
  destination_status varchar(40) not null default 'UNKNOWN' check (destination_status in ('NOT_SENT_TO_DCTFWEB', 'SENT_TO_DCTFWEB', 'OTHER', 'UNKNOWN')),
  source_document_id uuid references gov_documents(id),
  created_at timestamptz not null default now()
);

create index if not exists gov_declarations_entity_period_idx on gov_declarations (entity_id, period);

create table if not exists gov_remittances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_id uuid not null references gov_entities(id),
  payment_reference varchar(120),
  revenue_code varchar(40),
  payment_date date,
  amount_cents bigint not null default 0,
  recipient varchar(240),
  bank_reference varchar(120),
  source_document_id uuid references gov_documents(id),
  created_at timestamptz not null default now()
);

create table if not exists gov_accounting_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_id uuid not null references gov_entities(id),
  account_code varchar(80),
  account_description text,
  competence date not null,
  debit_cents bigint not null default 0,
  credit_cents bigint not null default 0,
  journal_reference varchar(120),
  source_document_id uuid references gov_documents(id),
  created_at timestamptz not null default now()
);

create table if not exists gov_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  entity_id uuid not null references gov_entities(id),
  period date,
  status varchar(40) not null default 'DRAFT' check (status in ('DRAFT', 'NEEDS_EVIDENCE', 'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'ON_HOLD')),
  gross_candidate_amount_cents bigint not null default 0,
  withheld_amount_cents bigint not null default 0,
  proven_destination_amount_cents bigint not null default 0,
  potential_amount_cents bigint,
  confidence varchar(20) check (confidence in ('LOW', 'MEDIUM', 'HIGH', 'VERIFIED')),
  legal_owner varchar(20) check (legal_owner in ('MUNICIPAL', 'FEDERAL', 'UNKNOWN')),
  cnr varchar(20),
  rule_id text,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gov_candidates_org_status_idx on gov_candidates (organization_id, status, updated_at desc);

create table if not exists gov_evidence_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  candidate_id uuid not null references gov_candidates(id) on delete cascade,
  document_id uuid references gov_documents(id),
  evidence_type varchar(60) not null,
  record_locator text,
  validation_status varchar(30) not null default 'PENDING' check (validation_status in ('PENDING', 'ACCEPTED', 'REJECTED', 'INCONCLUSIVE')),
  validated_by uuid references users(id),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists gov_evidence_links_candidate_idx on gov_evidence_links (candidate_id, validation_status);

create table if not exists gov_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  candidate_id uuid not null references gov_candidates(id) on delete cascade,
  reviewer_id uuid not null references users(id),
  reviewer_role varchar(40) not null,
  decision varchar(30) not null check (decision in ('APPROVE', 'REJECT', 'REQUEST_MORE_EVIDENCE')),
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists gov_reviews_candidate_idx on gov_reviews (candidate_id, created_at desc);

create table if not exists gov_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  candidate_id uuid not null references gov_candidates(id),
  procedure_type varchar(80),
  protocol_number varchar(120),
  protocol_date date,
  recognized_amount_cents bigint,
  recovered_amount_cents bigint,
  recovery_date date,
  status varchar(40) not null default 'OPEN' check (status in ('OPEN', 'DOCUMENTATION', 'LEGAL_REVIEW', 'READY_FOR_PROTOCOL', 'PROTOCOLLED', 'RECOVERED', 'CLOSED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gov_cases_org_status_idx on gov_cases (organization_id, status);

create table if not exists gov_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  actor_user_id uuid references users(id),
  action varchar(120) not null,
  object_type varchar(80) not null,
  object_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists gov_audit_events_org_time_idx on gov_audit_events (organization_id, occurred_at desc);
```

### 4.2 Backend — Domínio

**`lib/domain/gov.js`**

```javascript
const { getSql } = require('../db');
const { audit } = require('../audit');
const { HttpError } = require('../authz');

const STATUS_CANDIDATO = ['DRAFT', 'NEEDS_EVIDENCE', 'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'ON_HOLD'];
const DESTINO = ['PROVEN_MUNICIPAL', 'PROVEN_UNION', 'PROVEN_OTHER', 'DESTINATION_UNPROVEN'];
const STATUS_CASO = ['OPEN', 'DOCUMENTATION', 'LEGAL_REVIEW', 'READY_FOR_PROTOCOL', 'PROTOCOLLED', 'RECOVERED', 'CLOSED', 'REJECTED'];

async function listarMunicipios(ctx, query) {
  const sql = getSql();
  const uf = query.uf || null;
  const busca = query.q || null;
  let sqlText = `
    select id, ibge_code, name, state, cnpj_root, status, created_at
    from gov_municipalities
    where organization_id = ${ctx.organization.id}
  `;
  const params = [];
  let i = 1;
  if (uf) { sqlText += ` and state = $${i++}`; params.push(uf); }
  if (busca) { sqlText += ` and (name ILIKE $${i++} or ibge_code ILIKE $${i++})`; params.push(`%${busca}%`, `%${busca}%`); }
  sqlText += ` order by name`;
  const rows = await sql(sqlText, params);
  return { municipios: rows.map(r => ({ id: r.id, ibgeCode: r.ibge_code, name: r.name, state: r.state, cnpjRoot: r.cnpj_root, status: r.status, createdAt: r.created_at })) };
}

async function criarMunicipio(ctx, body) {
  const sql = getSql();
  const { ibgeCode, name, state, cnpjRoot } = body;
  if (!ibgeCode || !name || !state) throw new HttpError(400, 'INVALID_INPUT', 'ibgeCode, name e state são obrigatórios.');
  const row = (await sql`
    insert into gov_municipalities (organization_id, ibge_code, name, state, cnpj_root)
    values (${ctx.organization.id}, ${ibgeCode}, ${name}, ${state}, ${cnpjRoot || null})
    returning id, ibge_code, name, state, cnpj_root, status, created_at
  `)[0];
  await audit('gov.municipio.criado', {
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    entityType: 'gov_municipality',
    entityId: row.id,
    metadata: { ibgeCode: row.ibge_code, name: row.name }
  });
  return { id: row.id, ibgeCode: row.ibge_code, name: row.name, state: row.state, cnpjRoot: row.cnpj_root, status: row.status, createdAt: row.created_at };
}

async function listarCandidatos(ctx, query) {
  const sql = getSql();
  const status = query.status || null;
  let sqlText = `
    select c.id, c.entity_id, c.period, c.status, c.withheld_amount_cents,
           c.proven_destination_amount_cents, c.potential_amount_cents,
           c.confidence, c.legal_owner, c.cnr, c.updated_at,
           e.legal_name as entity_name, e.cnpj as entity_cnpj
    from gov_candidates c
    join gov_entities e on e.id = c.entity_id
    where c.organization_id = ${ctx.organization.id}
  `;
  const params = [];
  let i = 1;
  if (status) { sqlText += ` and c.status = $${i++}`; params.push(status); }
  sqlText += ` order by c.updated_at desc`;
  const rows = await sql(sqlText, params);
  return { candidatos: rows.map(r => ({
    id: r.id, entityId: r.entity_id, entityName: r.entity_name, entityCnpj: r.entity_cnpj,
    period: r.period, status: r.status,
    withheldAmountCents: Number(r.withheld_amount_cents),
    provenDestinationAmountCents: Number(r.proven_destination_amount_cents),
    potentialAmountCents: r.potential_amount_cents != null ? Number(r.potential_amount_cents) : null,
    confidence: r.confidence, legalOwner: r.legal_owner, cnr: r.cnr, updatedAt: r.updated_at
  })) };
}

async function obterCandidato(ctx, id) {
  const sql = getSql();
  const rows = await sql`
    select c.*, e.legal_name as entity_name, e.cnpj as entity_cnpj, e.entity_type
    from gov_candidates c
    join gov_entities e on e.id = c.entity_id
    where c.id = ${id} and c.organization_id = ${ctx.organization.id}
  `;
  if (!rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Candidato não encontrado.');
  const r = rows[0];
  const evidencias = await sql`
    select id, evidence_type, record_locator, validation_status, validated_by, validated_at, created_at
    from gov_evidence_links
    where candidate_id = ${id} and organization_id = ${ctx.organization.id}
    order by created_at desc
  `;
  return {
    id: r.id, entityId: r.entity_id, entityName: r.entity_name, entityCnpj: r.entity_cnpj, entityType: r.entity_type,
    period: r.period, status: r.status,
    grossCandidateAmountCents: Number(r.gross_candidate_amount_cents),
    withheldAmountCents: Number(r.withheld_amount_cents),
    provenDestinationAmountCents: Number(r.proven_destination_amount_cents),
    potentialAmountCents: r.potential_amount_cents != null ? Number(r.potential_amount_cents) : null,
    confidence: r.confidence, legalOwner: r.legal_owner, cnr: r.cnr, ruleId: r.rule_id, decisionReason: r.decision_reason,
    createdAt: r.created_at, updatedAt: r.updated_at,
    evidencias: evidencias.map(e => ({
      id: e.id, evidenceType: e.evidence_type, recordLocator: e.record_locator,
      validationStatus: e.validation_status, validatedBy: e.validated_by, validatedAt: e.validated_at, createdAt: e.created_at
    }))
  };
}

module.exports = {
  STATUS_CANDIDATO, DESTINO, STATUS_CASO,
  listarMunicipios, criarMunicipio, listarCandidatos, obterCandidato
};
```

**`lib/domain/gov-irrf.js`**

```javascript
const { HttpError } = require('../authz');

// Regras jurídicas do IRRF municipal (motor de classificação)
// Base: CF art. 158 I, Tema 1.130 STF, IN RFB 1.234/2012, Parecer SEI 480/2025/MF, EFD-Reinf NT 04/2026

const REGRAS_IRRF = {
  NO_WITHHOLDING: 'NO_WITHHOLDING',
  RETAINED_AND_RECOGNIZED: 'RETAINED_AND_RECOGNIZED',
  RETAINED_REMITTED_UNION: 'RETAINED_REMITTED_UNION',
  DESTINATION_UNPROVEN: 'DESTINATION_UNPROVEN',
  DECLARATION_MISMATCH: 'DECLARATION_MISMATCH',
  FUTURE_PROCESS_CORRECTION: 'FUTURE_PROCESS_CORRECTION'
};

function classificarIrrf({ reteve, destinoComprovado, apropriadoMunicipio, remetidoUniao, cnr, ehCNR11009 }) {
  // A. Município não reteve
  if (!reteve) return { status: REGRAS_IRRF.NO_WITHHOLDING, motivo: 'Não houve retenção na fonte. Sem retenção não há crédito municipal com base no Tema 1.130 (Parecer SEI 480/2025/MF).', creditoAutomatico: false };

  // B. Reteve e manteve/apropriou corretamente
  if (reteve && apropriadoMunicipio && !remetidoUniao) {
    return { status: REGRAS_IRRF.RETAINED_AND_RECOGNIZED, motivo: 'Retenção municipal apropriada. Não classificar como crédito a recuperar.', creditoAutomatico: false };
  }

  // CNR 11009 nunca é default de titularidade municipal
  if (ehCNR11009) {
    return { status: REGRAS_IRRF.DESTINATION_UNPROVEN, motivo: 'CNR 11009 indica IRRF pertencente à União (Nota Técnica 04/2026). Exigir interpretação contextual e regra jurídica versionada.', creditoAutomatico: false };
  }

  // C. Reteve e repassou à União
  if (reteve && remetidoUniao) {
    return { status: REGRAS_IRRF.RETAINED_REMITTED_UNION, motivo: 'Retenção comprovada e repasse à União. Abrir investigação, não validar crédito automaticamente.', creditoAutomatico: false };
  }

  // D. Reteve, destino não demonstrado
  if (reteve && !destinoComprovado) {
    return { status: REGRAS_IRRF.DESTINATION_UNPROVEN, motivo: 'Destino do valor não comprovado. Bloquear validação de crédito.', creditoAutomatico: false };
  }

  // E. Divergência declaração/contabilidade
  if (reteve && destinoComprovado) {
    return { status: REGRAS_IRRF.DECLARATION_MISMATCH, motivo: 'Divergência entre declaração e contabilidade. Exigir análise.', creditoAutomatico: false };
  }

  return { status: REGRAS_IRRF.DESTINATION_UNPROVEN, motivo: 'Cadeia de evidências incompleta.', creditoAutomatico: false };
}

module.exports = { classificarIrrf, REGRAS_IRRF };
```

**`lib/domain/gov-evidence.js`**

```javascript
const { getSql } = require('../db');
const { audit } = require('../audit');
const { HttpError } = require('../authz');

async function listarEvidencias(ctx, candidatoId) {
  const sql = getSql();
  const rows = await sql`
    select id, evidence_type, record_locator, validation_status, validated_by, validated_at, created_at
    from gov_evidence_links
    where candidate_id = ${candidatoId} and organization_id = ${ctx.organization.id}
    order by created_at desc
  `;
  return { evidencias: rows.map(r => ({
    id: r.id, evidenceType: r.evidence_type, recordLocator: r.record_locator,
    validationStatus: r.validation_status, validatedBy: r.validated_by, validatedAt: r.validated_at, createdAt: r.created_at
  })) };
}

async function vincularEvidencia(ctx, candidatoId, { documentId, evidenceType, recordLocator }) {
  const sql = getSql();
  const row = (await sql`
    insert into gov_evidence_links (organization_id, candidate_id, document_id, evidence_type, record_locator)
    values (${ctx.organization.id}, ${candidatoId}, ${documentId}, ${evidenceType}, ${recordLocator})
    returning id
  `)[0];
  await audit('gov.evidencia.vinculada', {
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    entityType: 'gov_evidence_link',
    entityId: row.id,
    metadata: { candidateId, evidenceType }
  });
  return { id: row.id };
}

async function registrarRevisao(ctx, candidatoId, { decision, reason }) {
  const sql = getSql();
  const row = (await sql`
    insert into gov_reviews (organization_id, candidate_id, reviewer_id, reviewer_role, decision, reason)
    values (${ctx.organization.id}, ${candidatoId}, ${ctx.user.id}, ${ctx.role}, ${decision}, ${reason})
    returning id, created_at
  `)[0];
  await audit('gov.revisao.registrada', {
    organizationId: ctx.organization.id,
    actorUserId: ctx.user.id,
    entityType: 'gov_review',
    entityId: row.id,
    metadata: { candidateId, decision }
  });
  return { id: row.id, decision, reason, createdAt: row.created_at };
}

module.exports = { listarEvidencias, vincularEvidencia, registrarRevisao };
```

### 4.3 Frontend

**`gov.html`** — seguir padrão de `dashboard.html` (carrega `/shell.js`, `/shell.css`, `gov.css`, `gov.js`)

**`gov.css`** — estilos isolados com prefixo `.gov-`

**`gov.js`** — chamadas API via `RV.api()`, estado de tela, renderização

### 4.4 Testes

**`tests/gov.test.js`** — testes de unidade do domínio (classificação IRRF, CRUD de municípios, etc.)

**`tests/gov-api.test.js`** — testes de API (usando `call()` de `tests/helpers.js`)

---

## 5. ARQUIVOS EXISTENTES A ALTERAR (mínimo, apenas adição)

### 5.1 `api/v1/[...route].js`
- **O que:** Adicionar `case 'gov':` no `switch (resource)` com as rotas propostas
- **Por que:** É o ponto único de entrada para todas as rotas `/api/v1/*`
- **Impacto:** Zero em rotas existentes (apenas acréscimo de um novo case)

### 5.2 `shell.js` (opcional, somente se autorizado)
- **O que:** Adicionar item de navegação para Gov no menu lateral
- **Por que:** Acesso à nova área de trabalho Gov
- **Condição:** Apenas se a gestão de acesso do Gov estiver definida; caso contrário, não alterar

---

## 6. TABELAS E ESTADOS (conforme `02_PLANO_DE_MODULOS_E_ARQUIVOS.md`)

### Estados do candidato
`DRAFT` → `NEEDS_EVIDENCE` → `UNDER_REVIEW` → `VALIDATED` / `REJECTED` / `ON_HOLD`

### Estados de destino
`PROVEN_MUNICIPAL` | `PROVEN_UNION` | `PROVEN_OTHER` | `DESTINATION_UNPROVEN`

### Estados do caso
`OPEN` → `DOCUMENTATION` → `LEGAL_REVIEW` → `READY_FOR_PROTOCOL` → `PROTOCOLLED` → `RECOVERED` / `CLOSED` / `REJECTED`

> **Regra:** Não usar `VALIDATED` sem cadeia probatória completa e revisão humana.

---

## 7. ROTAS API PROPOSTAS (conforme `05_API_E_UX.md`)

| Método | Endpoint | Finalidade |
|--------|----------|------------|
| GET | `/api/v1/gov/dashboard` | Visão geral Gov |
| GET | `/api/v1/gov/municipios` | Listar municípios |
| POST | `/api/v1/gov/municipios` | Criar município |
| GET | `/api/v1/gov/municipios/:id` | Detalhe município |
| PATCH | `/api/v1/gov/municipios/:id` | Atualizar município |
| GET | `/api/v1/gov/fontes` | Listar fontes |
| POST | `/api/v1/gov/fontes` | Cadastrar fonte |
| POST | `/api/v1/gov/ingestoes` | Iniciar ingestão |
| GET | `/api/v1/gov/ingestoes/:id` | Status ingestão |
| GET | `/api/v1/gov/candidatos` | Listar candidatos |
| GET | `/api/v1/gov/candidatos/:id` | Detalhe candidato |
| POST | `/api/v1/gov/candidatos/:id/revisao` | Registrar revisão |
| GET | `/api/v1/gov/casos` | Listar casos |
| POST | `/api/v1/gov/casos` | Criar caso |
| GET | `/api/v1/gov/casos/:id` | Detalhe caso |
| GET | `/api/v1/gov/casos/:id/relatorio` | Relatório do caso |

---

## 8. TELAS PROPOSTAS (conforme `05_API_E_UX.md`)

1. **Visão geral Gov** — municípios, fontes, ingestões, candidatos por status; sem exibir "crédito recuperado" sem prova
2. **Municípios** — dados cadastrais e entidades vinculadas
3. **Diagnóstico** — pagamentos, períodos, sinais e documentos pendentes
4. **Candidato** — linha do tempo de evidências, regra aplicada, cálculo e lacunas
5. **Revisão** — aprovar, rejeitar ou solicitar evidência; justificativa obrigatória
6. **Casos** — fases e documentos do procedimento
7. **Relatório** — metodologia, período, evidências, ressalvas, status e valores separados (estimado/validado/recuperado)

---

## 9. CRITÉRIOS DE ACEITE MÍNIMOS

- [ ] O Reversa atual continua funcionando sem regressões (testes existentes passam)
- [ ] O Reversa Gov é acessível como módulo novo, sem quebrar rotas ou fluxos existentes
- [ ] Alterações são pequenas, rastreáveis e isoladas
- [ ] Testes automatizados cobrem regras, permissões existentes, isolamento de dados e fluxos novos
- [ ] Nenhuma conclusão de crédito é apresentada sem trilha de evidências e revisão humana
- [ ] Nenhuma alteração em produção ou envio ao repositório remoto ocorre sem autorização expressa
- [ ] Migration `014_gov.sql` cria apenas tabelas `gov_*` (não modifica tabelas existentes)
- [ ] Rota `gov` no roteador não altera comportamento de rotas existentes

---

## 10. O QUE NÃO FAZER (escopo fora desta fase)

- [x] Não reconstruir ou substituir o Reversa atual
- [x] Não fazer refatorações amplas
- [x] Não alterar autenticação, middleware, papéis/permissões ou regras globais
- [x] Não executar migrations em produção
- [x] Não fazer deploy nem push para repositório remoto
- [x] Não implementar gestão de usuários/permissões específicas do Gov (fase posterior)
- [x] Não criar endpoints de transmissão fiscal (e-CAC, EFD-Reinf, eSocial, DCTFWeb)
- [x] Não protocolar automaticamente PER/DCOMP ou ação judicial
- [x] Não calcular crédito sem comprovantes
- [x] Não usar CNR 11009 como padrão automático
- [x] Não expor o módulo em produção (apenas ambiente local/dev)

---

## 11. PRÓXIMOS PASSOS IMEDIATOS

1. Criar branch isolada no repositório `reversa-main`
2. Executar `npm test` para estabelecer baseline (zero falhas)
3. Criar migration `db/migrations/014_gov.sql`
4. Criar arquivos de domínio (`gov.js`, `gov-irrf.js`, `gov-evidence.js`)
5. Criar testes `tests/gov.test.js`
6. Rodar testes e verificar zero regressões
7. Adicionar rota `gov` no roteador `api/v1/[...route].js`
8. Criar frontend (`gov.html`, `gov.css`, `gov.js`)
9. Criar testes de API `tests/gov-api.test.js`
10. Entregar diff completo e instruções de execução

---

**Documentos de referência:**
- `LEIA_PRIMEIRO_Reversa_Gov.md` — orientação principal
- `00_LEIA_PRIMEIRO.md` — regras operacionais
- `01_ARQUITETURA_REAL_OBSERVADA.md` — stack e padrões
- `02_PLANO_DE_MODULOS_E_ARQUIVOS.md` — arquivos e tabelas
- `03_REGRAS_IRRF_E_GATES_JURIDICOS.md` — motor jurídico IRRF
- `04_FONTES_E_INGESTAO.md` — fontes e ingestão
- `05_API_E_UX.md` — rotas e telas
- `08_PLANO_DE_EXECUCAO_PARA_AGENTE.md` — fases de execução
- `Reversa_PRD_Modulo_IRRF_Municipal.md` — PRD completo