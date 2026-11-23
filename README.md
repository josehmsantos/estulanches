# EstuLanches

Sistema de **cardápio e pedidos de uma cantina escolar**. A interface (HTML/CSS/JavaScript) é servida pelo Express, e a API grava os dados em PostgreSQL. A implantação de produção usa **Docker Compose**.

| Camada | Tecnologia |
|---|---|
| Frontend | HTML, CSS e JavaScript puro (`public/`), servido pelo Express |
| Backend | Node.js 22 + Express 4 (rotas → controllers → services → repositories) |
| Banco de dados | PostgreSQL 16 (`init.sql` cria as tabelas e o cardápio inicial) |
| Validação / segurança | Zod, Helmet (CSP), CORS, rate limit, SQL parametrizado, logs Pino |
| Containers | Docker + Docker Compose |
| Testes | Jest + Supertest (unitários e de integração) |

## Estrutura do projeto

```
EstuLanches/
├── Dockerfile               # imagem em 3 estágios (dependências, test, production)
├── docker-compose.yml       # serviços db, app e tests (perfil "test")
├── .env.example             # modelo das variáveis de ambiente (sem segredos reais)
├── init.sql                 # tabelas + produtos iniciais (roda só na 1ª subida do volume)
├── src/                     # API: app.js, routes/, controllers/, services/, repositories/
├── public/                  # interface web
├── tests/
│   ├── unit/                # testes unitários (sem banco)
│   └── integration/         # testes de integração (API + PostgreSQL real)
├── scripts/                 # validar-ambiente, testar-persistencia, gerar-rdm, rodar-rdm, gerar-env
├── rdm/                     # Ficha RDM (PDF) e resultados reais dos testes/validação (JSON)
└── docs/                    # SEGURANCA.md, ESCALABILIDADE.md, ARQUITETURA.md, ROTEIRO-VIDEO.md
```

## 1. Pré-requisitos

- **Docker** com **Docker Compose** (Docker Desktop no Windows/macOS). Confira com `docker --version` e `docker compose version`; `docker info` não pode dar erro.
- **Node.js 22+** e npm (só para rodar os testes unitários e os scripts fora do container).
- **Git**.

## 2. Configuração (variáveis de ambiente)

As credenciais **não ficam no repositório**. Crie o arquivo `.env` (ele está no `.gitignore`):

```sh
npm install        # instala as dependências (necessário para os scripts e testes)
npm run env        # cria o .env com uma senha aleatória para o banco
```

Alternativa manual: `cp .env.example .env` e troque `POSTGRES_PASSWORD` (use só letras e números).

| Variável | Para que serve | Padrão |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` | Nome do banco e usuário | `estulanches` / `estu_app` |
| `POSTGRES_PASSWORD` | Senha do banco (**obrigatória**; o Compose recusa subir sem ela) | gerada por `npm run env` |
| `HOST_PORT` | Porta do seu computador onde o sistema abre | `3000` |
| `CORS_ORIGIN` | Origem permitida para chamadas de navegador | `http://localhost:3000` |
| `LOG_LEVEL` | Nível dos logs (`info`, `warn`, `silent`...) | `info` |

A porta **interna** da aplicação é sempre `3000`; para mudar a porta do computador altere só `HOST_PORT`.

## 3. Executar em produção (Docker Compose)

```sh
docker compose up -d --build   # constrói a imagem e sobe banco + aplicação
docker compose ps              # os dois serviços devem aparecer como (healthy)
docker compose logs            # logs de app e banco (use "logs app" ou "logs db" para filtrar)
```

- Sistema: http://localhost:3000
- Saúde da API: http://localhost:3000/health → `{"status":"ok","database":"connected"}`
- API: `GET /api/products`, `POST /api/products`, `PUT/DELETE /api/products/:id`, `GET/POST /api/orders`, `PATCH /api/orders/:id/status`

Ordem de inicialização: o **banco** sobe primeiro; a **aplicação** só inicia depois que o healthcheck do banco ficar saudável (`depends_on: condition: service_healthy`).

Parar: `docker compose stop` (mantém tudo) · `docker compose down` (remove containers, **mantém os dados**) · `docker compose down -v` (remove containers **e apaga os dados**).

### Verificar o banco e a persistência

```sh
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"'
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id,name,price FROM products ORDER BY id;"'
npm run persistencia     # grava um produto, faz "down" + "up" e confere se o dado continuou lá
```

Os dados ficam no volume nomeado `postgres_data`, que sobrevive a `down` e a reinícios.

## 4. Testes

| Comando | O que faz |
|---|---|
| `npm run test:unit` | Testes unitários (regras de pedido, validações, tratamento de erro do repositório). Não precisam de banco. |
| `docker compose --profile test run --build --rm tests` | Testes de integração dentro do Compose, contra o PostgreSQL do próprio Compose (banco precisa estar no ar: `docker compose up -d db`). |
| `npm test` | Unitários + integração via Compose. |
| `npm run test:coverage` | Cobertura dos testes unitários. |

Para rodar a integração fora do Docker, aponte `DATABASE_URL` para um PostgreSQL que já tenha o `init.sql` aplicado:

```sh
DATABASE_URL=postgresql://usuario:senha@localhost:5432/estulanches npm run test:integration
```

Os testes de integração criam seus próprios dados e apagam tudo ao final. Os resultados ficam em `rdm/testes-unitarios.json` e `rdm/testes-integracao.json`.

## 5. Validação da implantação e Ficha RDM

Com o ambiente no ar:

```sh
npm run validar    # confere containers (healthy), portas, acesso ao banco, /health e erros críticos nos logs → rdm/resultados.json
npm run rdm        # roda TUDO (unitários, integração, persistência, validação) e gera rdm/RDM-EstuLanches.pdf
```

A Ficha RDM (`rdm/RDM-EstuLanches.pdf`, uma página) usa **somente resultados reais** gravados em `rdm/*.json`. O que ainda não foi medido aparece como **PENDENTE**. Antes de entregar:

1. Edite `rdm/config-rdm.json` e troque `"nome": "PREENCHER: seu nome"` pelo seu nome.
2. Rode `npm run rdm` na máquina com Docker e confirme que o status ficou **SUCESSO**.

## 6. Segurança e escalabilidade

- Medidas aplicadas e justificativas: [docs/SEGURANCA.md](docs/SEGURANCA.md)
- Como atender 1 milhão de usuários (100 mil simultâneos): [docs/ESCALABILIDADE.md](docs/ESCALABILIDADE.md) (explicação conceitual)
- Arquitetura do código: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- Roteiro do vídeo de apresentação: [docs/ROTEIRO-VIDEO.md](docs/ROTEIRO-VIDEO.md)

## 7. Publicar no GitHub

```sh
git status                      # confirme que .env NÃO aparece
git add .
git commit -m "Implantação do EstuLanches com Docker, testes e Ficha RDM"
git push
```

Se for um repositório novo: crie-o vazio no GitHub e use `git remote add origin URL` e `git push -u origin main`. Nunca envie o `.env`.

## 8. Problemas comuns

- **`required variable POSTGRES_PASSWORD is missing`**: o `.env` não existe. Rode `npm run env`.
- **Porta 3000 ocupada**: coloque `HOST_PORT=3001` no `.env` e rode `docker compose up -d`.
- **App não conecta depois de trocar a senha**: o PostgreSQL só lê a senha ao criar o volume. Para recomeçar do zero (apaga os dados): `docker compose down -v` e suba de novo.
- **Docker indisponível**: abra o Docker Desktop e aguarde; confira com `docker info`.
- **Serviço não fica `healthy`**: veja `docker compose logs db` e `docker compose logs app`.

## 9. Limitações conhecidas

- O sistema **não tem login/autenticação**: qualquer pessoa com acesso à porta pode editar o cardápio e os pedidos. É adequado para demonstração em rede local; para uso real, adicione autenticação e HTTPS (proxy reverso).
- A API aceita qualquer troca de status de pedido (por exemplo, de `ENTREGUE` de volta para `RECEBIDO`); não há máquina de estados.
- Produtos já usados em pedidos não podem ser excluídos (a API responde 409); marque-os como indisponíveis.
- A configuração Docker e os scripts `validar`/`persistencia`/`rdm` precisam de um daemon Docker com acesso ao Docker Hub para baixar `postgres:16-alpine` e `node:22-alpine`.
