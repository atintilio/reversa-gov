# Reversa Gov

Módulo IRRF Municipal para a plataforma Reversa (Argus Prime). Este repositório contém o módulo e seus testes reproduzíveis; a aplicação hospedeira fornece autenticação, autorização, acesso ao PostgreSQL, auditoria e a interface compartilhada `shell.js`/`shell.css`.

O módulo organiza municípios, candidatos à análise, evidências e revisões. Estimativas não são créditos reconhecidos: a classificação nunca concede crédito automaticamente, e a criação de candidatos não aceita o estado `VALIDATED`.

## Instalar e testar

Requer Node.js >= 20.

```sh
npm ci
npm test
npm run test:reversa
```

- `npm test`: domínio, API com sessões reais, isolamento entre organizações, validações, auditoria, migrations e comportamento da tela em DOM.
- `npm run test:reversa`: regressões selecionadas da base Reversa original: autenticação, segurança, domínio, isolamento, CRM, migrations e histórico.

Os testes usam PostgreSQL em memória (PGlite), uma cópia descartável da base fornecida e o módulo deste repositório. Não consultam `DATABASE_URL` nem aplicam migrations em bancos externos. O conteúdo de `tests/fixtures/` é descrito em [tests/fixtures/README.md](tests/fixtures/README.md).

## Integrar ao Reversa

1. Trabalhar em branch de desenvolvimento da aplicação hospedeira.
2. Copiar `gov.html`, `gov.css`, `gov.js`, os arquivos `lib/domain/gov*.js` e as migrations `014_gov.sql` e `015_gov_tenant_integrity.sql` para os mesmos caminhos.
3. Aplicar a adição descrita em [PATCH_ROTEADOR_GOV.md](PATCH_ROTEADOR_GOV.md) ao roteador existente.
4. Aplicar migrations apenas ao banco local/de testes e executar os testes da aplicação completa antes de qualquer integração.

Não copiar os fixtures para a aplicação hospedeira. As bibliotecas de teste estão em `devDependencies`; as dependências de runtime continuam sendo as da plataforma Reversa.

A migration 015 preserva o arquivo 014 e seu checksum. Ela permite cadastros separados de um mesmo município/CNPJ por organização e impõe integridade de organização nos vínculos de municípios, entidades, candidatos, evidências, revisões e casos. Dados preexistentes incompatíveis fazem a migration falhar e precisam ser analisados antes de uma aplicação autorizada.

## Rotas implementadas

| Caminho relativo a `/api/v1/gov` | Métodos |
| --- | --- |
| `/municipios` | GET, POST |
| `/candidatos` | GET, POST |
| `/candidatos/:id` | GET |
| `/candidatos/:id/evidencias` | GET, POST |
| `/candidatos/:id/revisao` | POST |
| `/dashboard` | GET |

As rotas reutilizam `context()` e `deny()` da aplicação. Escrita usa a permissão `write`, revisão usa `review`. A revisão registra decisão, justificativa e autoria; a transição para crédito validado depende da implementação futura dos gates documentais/jurídicos. Não há resposta de sucesso simulada para funcionalidades futuras.

## Limites e regras

Ingestão, fontes, casos/relatórios completos e validação jurídica final permanecem em fases futuras. Os testes de DOM não substituem testes visuais no navegador. Os testes selecionados da base não representam sua suíte completa nem verificam serviços externos de produção.

Não alterar funcionalidades, autenticação, permissões globais ou segredos da aplicação hospedeira. Push, deploy e operações em produção exigem autorização expressa. Nenhuma migration em produção ou deploy faz parte desta correção.

Os documentos `PLANO_IMPLEMENTACAO_REVERSA_GOV.md` e `RESUMO_IMPLEMENTACAO_REVERSA_GOV.md` registram a implementação inicial; os comandos e limites atuais são os deste README.

## Licença

Privado — Argus Prime.
