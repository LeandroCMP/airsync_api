# AirSync API

## Visão geral
A AirSync API é uma plataforma completa para gestão de empresas de climatização, construída com NestJS, TypeScript e MongoDB. Ela oferece autenticação JWT com rotação de refresh tokens, multi-tenancy, RBAC, auditoria, módulos funcionais (clientes, ordens de serviço, estoque, financeiro, frota, contratos, CRM, sync offline), geração de PDFs e uploads locais.

Este guia descreve todos os passos necessários para configurar o ambiente, executar a API localmente e exercitar as principais rotas.

## Pré-requisitos
- Node.js 20 ou superior.
- npm 9+ (instalado junto com o Node).
- MongoDB 6+ em execução localmente **ou** Docker/Docker Compose para subir uma instância local.
- Espaço em disco para armazenar arquivos enviados (padrão `./uploads`).

## Preparação do projeto
1. Instale as dependências:
   ```bash
   npm install
   ```
   > Se a sua rede bloquear o registro público do npm, configure as variáveis `npm_config_registry` ou use um mirror interno antes de executar o comando.

2. Copie o arquivo de exemplo de ambiente:
   ```bash
   cp .env.example .env
   ```

3. Edite `.env` conforme o seu ambiente (detalhes na próxima seção).

## Parâmetros obrigatórios de configuração
Informe (ou defina) os seguintes valores antes de iniciar a API:

| Variável | Descrição | Valor sugerido em desenvolvimento |
| --- | --- | --- |
| `MONGODB_URI` | URI de conexão com o MongoDB. Inclui host, porta, base e, se necessário, usuário/senha. | `mongodb://localhost:27017/airsync` |
| `JWT_ACCESS_SECRET` | Segredo do token de acesso. Gere uma string forte e mantenha-a fora do controle de versão. | `dev_access_secret` |
| `JWT_REFRESH_SECRET` | Segredo do token de refresh. Deve ser diferente do anterior. | `dev_refresh_secret` |
| `JWT_ACCESS_EXPIRES` | Tempo de expiração do access token. Aceita sufixos `s`, `m`, `h`, `d`. | `900s` (15 minutos) |
| `JWT_REFRESH_EXPIRES` | Tempo de expiração do refresh token. | `30d` |
| `UPLOAD_DIR` | Caminho relativo/absoluto para salvar arquivos enviados. O diretório será criado automaticamente. | `./uploads` |
| `CORS_ORIGINS` | Lista separada por vírgulas de origens autorizadas. Use `*` em desenvolvimento. | `*` |

> Se precisar me informar detalhes para preparar o ambiente por você, forneça: host/porta do MongoDB, nome do banco, credenciais (se houver), política de expiração desejada para tokens, caminho de upload e origens permitidas para CORS.

## Subindo o MongoDB localmente
### Opção 1 – Instância já instalada na máquina
1. Inicie o serviço MongoDB (por exemplo, `mongod --dbpath /dados/mongo`).
2. Garanta que a base definida em `MONGODB_URI` exista ou será criada automaticamente na primeira execução.

### Opção 2 – Docker Compose (fornecido)
1. Certifique-se de que Docker e Docker Compose estão instalados.
2. Execute:
   ```bash
   docker compose up -d
   ```
3. A API pode usar a URI `mongodb://localhost:27017/airsync` (sem autenticação) ou `mongodb://admin:admin@localhost:27017/airsync?authSource=admin` caso deseje habilitar autenticação. Ajuste `MONGODB_URI` conforme a escolha.
4. (Opcional) A interface Mongo Express estará disponível em `http://localhost:8081`.

## Executando a API
1. Certifique-se de que o diretório definido em `UPLOAD_DIR` exista ou permita criação automática.
2. Rode a aplicação em modo desenvolvimento (com reload automático):
   ```bash
   npm run start:dev
   ```
3. A API ficará disponível em `http://localhost:3000` (personalize com `PORT`).
4. A documentação Swagger estará em `http://localhost:3000/docs` (necessário incluir o token Bearer nas requisições protegidas).

### Seeds automáticos
Na primeira execução com banco vazio, o serviço `SeedService` cria:
- Tenant **Demo**.
- Usuário administrador: `admin@demo.local` / senha `admin123`.
- Cliente "Leandro Campos" com telefone/e-mail de exemplo.
- Item de estoque "Filtro de Ar" (`SKU: FLT-7500`).
- Ordem de serviço exemplo vinculada ao item de estoque.

Use essas credenciais para o primeiro login.

## Testando o fluxo principal de rotas
> Todas as rotas (exceto register/login) exigem o cabeçalho `X-Tenant-Id` com o ID do tenant e `Authorization: Bearer <access_token>`.

1. **Login**
   ```bash
   curl -X POST http://localhost:3000/v1/auth/login \
     -H 'Content-Type: application/json' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     -d '{"email":"admin@demo.local","password":"admin123"}'
   ```
   Resposta: tokens `accessToken`, `refreshToken`, `jti` e dados do usuário. O `TENANT_ID` é retornado pelo seed (`/docs` ou Mongo). Você pode obtê-lo fazendo login via Swagger com o cabeçalho correto ou consultando a coleção `tenants`.

2. **Criar cliente**
   ```bash
   curl -X POST http://localhost:3000/v1/clients \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     -d '{"name":"Cliente Teste","phones":["+55 11 95555-0000"],"emails":["teste@example.com"]}'
   ```

3. **Criar ordem de serviço**
   ```bash
   curl -X POST http://localhost:3000/v1/orders \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     -d '{"clientId":"<CLIENT_ID>","status":"scheduled","technicianIds":["<USER_ID>"]}'
   ```
   > Os IDs podem ser obtidos consultando as rotas `GET /v1/clients` e `GET /v1/users`.

4. **Reservar materiais**
   ```bash
   curl -X POST http://localhost:3000/v1/orders/<ORDER_ID>/materials/reserve \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     -d '[{"itemId":"<INVENTORY_ITEM_ID>","qty":1}]'
   ```

5. **Finalizar ordem (baixa de estoque e financeiro)**
   ```bash
   curl -X POST http://localhost:3000/v1/orders/<ORDER_ID>/finish \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     -d '{"materials":[{"itemId":"<INVENTORY_ITEM_ID>","qty":1}],"billing":{"items":[{"type":"service","name":"Limpeza","qty":1,"unitPrice":150} ],"discount":0,"total":150}}'
   ```
   Isso gera uma transação a receber (`FinanceTransaction`).

6. **Pagar transação**
   ```bash
   curl -X PATCH http://localhost:3000/v1/finance/transactions/<TRANSACTION_ID>/pay \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     -d '{"method":"PIX","amount":150}'
   ```

7. **Consultar sync offline**
   ```bash
   curl -X GET 'http://localhost:3000/v1/sync/changes?since=2024-01-01T00:00:00.000Z&scope=orders,inventory&includeDeleted=true' \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>'
   ```

8. **Gerar PDF da ordem**
   ```bash
   curl -X GET 'http://localhost:3000/v1/orders/<ORDER_ID>/pdf?type=report' \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     --output ordem.pdf
   ```

9. **Uploads locais**
   ```bash
   curl -X POST http://localhost:3000/v1/files/upload \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'X-Tenant-Id: <TENANT_ID>' \
     -F 'file=@/caminho/para/foto.jpg'
   ```
   O arquivo ficará disponível em `http://localhost:3000/files/<nome>`.

## Testes automatizados
1. **Testes unitários**
   ```bash
   npm test
   ```
2. **Testes e2e**
   ```bash
   npm run test:e2e
   ```
   > Os testes e2e utilizam `mongodb-memory-server`. Na primeira execução ele baixa um binário (~100 MB). Certifique-se de que sua rede permite o download.

## Dicas adicionais
- Configure um reverse proxy (ex.: Nginx) apenas em produção para servir `/files` e repassar `/v1` para a API.
- Habilite HTTPS em produção e troque os segredos JWT por valores seguros.
- Automatize o backup da pasta de uploads e do MongoDB (dump ou snapshots).

Com essa documentação, você consegue preparar o ambiente, executar a AirSync API e validar as rotas essenciais ponta a ponta.
