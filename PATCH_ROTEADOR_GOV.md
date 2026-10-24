# Integração da rota Gov no Reversa

A autenticação, o middleware e as permissões continuam sendo os da aplicação hospedeira. A única alteração no roteador existente `api/v1/[...route].js` é adicionar, dentro de `switch (resource)`, antes de `default:`:

```js
    case 'gov':
      return require('../../lib/domain/gov-routes')({ ctx, m, query, body, parts: segments(req), deny }, res);
```

A linha corresponde exatamente à integração usada pelos testes deste repositório. O contexto `ctx` já deve ter sido obtido por `context(req)` no roteador; `deny`, `segments`, `query` e `body` também são os existentes. O wrapper do roteador permanece responsável pelo tratamento de `HttpError`.

Copiar todos os arquivos `lib/domain/gov*.js`, incluindo `gov-routes.js` e `gov-validation.js`. O módulo usa os utilitários reais `lib/db.js`, `lib/http.js`, `lib/audit.js` e `lib/authz.js`; não criar substitutos desses arquivos.

Copiar `gov.html`, `gov.css` e o **frontend** `gov.js` para a raiz. O **backend** é `lib/domain/gov.js`: os dois arquivos têm o mesmo nome e não devem ser confundidos ao copiar.

Adicionar `014_gov.sql` e `015_gov_tenant_integrity.sql` ao diretório de migrations, sem alterar migrations já aplicadas. Antes de aplicar 015 em qualquer banco com dados, verificar vínculos entre organizações e valores monetários incompatíveis; a migration rejeita inconsistências em vez de apagar dados.

Os endpoints implementados estão listados no README. As rotas futuras não retornam sucesso fictício. A rota de revisão registra a decisão e preserva o estado do candidato até a implementação dos gates documentais/jurídicos completos.

## Verificação

```sh
npm ci
npm test
npm run test:reversa
```

Esses comandos pertencem ao repositório do módulo. Depois de integrá-lo à aplicação, executar também a suíte completa da aplicação hospedeira. Os fixtures arquivados são apenas infraestrutura de testes e não devem ser copiados para o produto.

Não alterar `lib/auth.js`, `lib/authz.js`, `lib/db.js`, `middleware.js`, `shell.js`, `shell.css` ou páginas existentes como parte deste patch. Não executar migrations em produção ou deploy sem autorização expressa.
