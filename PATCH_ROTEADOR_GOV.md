# PATCH — api/v1/[...route].js (Reversa Gov)

Este é o **único arquivo existente** que requer alteração (adição mínima).
Todas as demais mudanças são arquivos **novos**.

## 1. Adicionar import (após a linha 15, antes de `function deny`)

```js
const gov = require('../../lib/domain/gov');
```

## 2. Adicionar case `gov` no switch (antes do `default:`)

Inserir este bloco imediatamente antes de `default:` (linha 250):

```js
    case 'gov': {
      // /gov/municipios · /gov/municipios/:id · /gov/fontes · /gov/ingestoes
      // /gov/candidatos · /gov/candidatos/:id · /gov/candidatos/:id/revisao
      // /gov/casos · /gov/casos/:id · /gov/casos/:id/relatorio · /gov/dashboard
      const [, sub, sid, sact] = segments(req);

      if (sub === 'dashboard' && m === 'GET') {
        return json(res, 200, { municipios: 0, candidatos: 0, emRevisao: 0, validados: 0, mensagem: 'Dashboard Gov — implementar em Fase 2' });
      }

      if (sub === 'municipios' && !sid) {
        if (m === 'GET') return json(res, 200, await gov.listarMunicipios(ctx, query));
        if (m === 'POST') {
          deny(ctx, 'write', 'gov.municipio.create');
          return json(res, 201, await gov.criarMunicipio(ctx, body));
        }
        return method(res, ['GET', 'POST']);
      }

      if (sub === 'municipios' && sid && !sact) {
        if (m === 'GET') return json(res, 200, { id: sid, mensagem: 'Detalhe do município — implementar em Fase 2' });
        if (m === 'PATCH') { deny(ctx, 'write', 'gov.municipio.update'); return json(res, 200, { ok: true }); }
        return method(res, ['GET', 'PATCH']);
      }

      if (sub === 'fontes' && !sid) {
        if (m === 'GET') return json(res, 200, { fontes: [], mensagem: 'Fontes — implementar em Fase 2' });
        if (m === 'POST') { deny(ctx, 'write', 'gov.fonte.create'); return json(res, 201, { ok: true }); }
        return method(res, ['GET', 'POST']);
      }

      if (sub === 'ingestoes' && !sid && m === 'POST') {
        deny(ctx, 'write', 'gov.ingestao.create');
        return json(res, 201, { ok: true, mensagem: 'Ingestão — implementar em Fase 4' });
      }

      if (sub === 'ingestoes' && sid && !sact && m === 'GET') {
        return json(res, 200, { id: sid, status: 'pendente', mensagem: 'Ingestão — implementar em Fase 4' });
      }

      if (sub === 'candidatos' && !sid && m === 'GET') {
        return json(res, 200, await gov.listarCandidatos(ctx, query));
      }

      if (sub === 'candidatos' && sid && !sact && m === 'GET') {
        return json(res, 200, await gov.obterCandidato(ctx, sid));
      }

      if (sub === 'candidatos' && sid && sact === 'revisao' && m === 'POST') {
        deny(ctx, 'review', 'gov.candidato.review');
        return json(res, 200, await govEvidence.registrarRevisao(ctx, sid, body));
      }

      if (sub === 'casos' && !sid) {
        if (m === 'GET') return json(res, 200, { casos: [], mensagem: 'Casos — implementar em Fase 4' });
        if (m === 'POST') { deny(ctx, 'write', 'gov.caso.create'); return json(res, 201, { ok: true }); }
        return method(res, ['GET', 'POST']);
      }

      if (sub === 'casos' && sid && !sact && m === 'GET') {
        return json(res, 200, { id: sid, mensagem: 'Caso — implementar em Fase 4' });
      }

      if (sub === 'casos' && sid && sact === 'relatorio' && m === 'GET') {
        return json(res, 200, { id: sid, mensagem: 'Relatório — implementar em Fase 4' });
      }

      return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Rota Gov não encontrada.' } });
    }

    default:
```

## 3. Adicionar import do gov-evidence (após a linha 15)

```js
const govEvidence = require('../../lib/domain/gov-evidence');
```

## Arquivos que NÃO devem ser alterados

- `api/v1/rota.js` — apenas ponte, sem alteração
- `lib/auth.js`, `lib/authz.js` — autenticação/autorização existentes, sem alteração
- `lib/db.js` — acesso ao banco, sem alteração
- `shell.js`, `shell.css` — UI compartilhado, sem alteração (salvo instrução expressa)
- Qualquer página HTML existente (`dashboard.html`, `clientes.html`, etc.)
- Qualquer migration existente (`001_` a `013_`)
- Qualquer teste existente (`tests/*.test.js`)