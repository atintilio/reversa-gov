# Base real usada nos testes

`reversa-baseline.tar.gz` contém um snapshot de código e recursos de teste da aplicação Reversa fornecida pelo usuário, extraída de `reversa-main.zip`. A cópia local de origem foi `/tmp/opencode/reversa_source/reversa-main/reversa-main` (arquivos da plataforma datados de 20/10/2026).

O archive exclui os arquivos Gov, `014_gov.sql`, `.env`, `node_modules` e dados de clientes. Inclui os módulos e migrations 001–013, roteador, autenticação, testes originais, motores usados por suas dependências e fontes/logo necessários à geração de PDFs de teste. As licenças das fontes estão junto delas no archive. Não contém credenciais reais; os segredos literais nos testes originais são fixtures.

`reversa-baseline.sha256.json` registra o SHA-256 de cada arquivo. `tests/helpers.js` extrai e verifica o snapshot em diretório temporário, copia os arquivos Gov atuais, aplica a adição documentada ao roteador e conecta apenas bancos PGlite em memória. Ao final, fecha os bancos e remove a cópia.

`npm run test:reversa` executa as suítes originais `auth`, `security`, `domain`, `isolamento`, `crm`, `migrate` e `historico`. A única adaptação desses testes na cópia descartável é fechar os bancos ao término. Nenhuma implementação de autenticação, permissão ou domínio global foi alterada.

O snapshot é somente um fixture para testes de integração e regressão. A versão real da aplicação hospedeira deve ser testada novamente quando o módulo for integrado. Para atualizar a base, revisar os arquivos fornecidos e regenerar archive e manifest juntos; não aceitar mudanças de checksum silenciosamente.
