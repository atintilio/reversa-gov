# Reversa Gov

Módulo IRRF Municipal para a plataforma Reversa (Argus Prime).

## Objetivo

Implementar o módulo **Reversa Gov** dentro do repositório existente `reversa-main`, sem substituir, reescrever ou degradar o Reversa atual.

O módulo apoia a identificação, documentação e análise de créditos tributários potencialmente recuperáveis por municípios, com foco no IRRF municipal (Tema 1.130 do STF, IN RFB 1.234/2012, Parecer SEI 480/2025/MF).

## Estrutura

```
reversa-gov/
├── db/migrations/014_gov.sql      # Migration com tabelas gov_*
├── lib/domain/gov.js              # Domínio: municípios e candidatos
├── lib/domain/gov-irrf.js         # Motor de classificação IRRF
├── lib/domain/gov-evidence.js     # Evidências e revisão humana
├── gov.html                       # Página inicial do módulo
├── gov.css                        # Estilos isolados (.gov-)
├── gov.js                         # Lógica frontend
├── tests/gov.test.js              # Testes de unidade (9 testes)
├── tests/gov-api.test.js          # Testes de API
├── PATCH_ROTEADOR_GOV.md          # Instruções para adicionar rota no roteador
├── PLANO_IMPLEMENTACAO_REVERSA_GOV.md   # Plano de implementação por fases
├── RESUMO_IMPLEMENTACAO_REVERSA_GOV.md  # Resumo executivo
└── README.md                      # Este arquivo
```

## Regras inegociáveis

- Não alterar nem reescrever funcionalidades existentes do Reversa
- Não fazer refatorações amplas fora do escopo do módulo Gov
- Não alterar autenticação, middleware, papéis/permissões ou regras globais
- Não executar migrations em produção, não publicar deploy, não fazer push sem autorização expressa
- Gestão de usuários e permissões específicas do Gov será definida em etapa posterior

## Testes

Todos os 9 testes de unidade do Reversa Gov passam:

```
node --test tests/gov.test.js
```

## Licença

Privado - Argus Prime