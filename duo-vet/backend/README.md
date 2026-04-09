# Backend Duo Vet

## Como rodar localmente

1. Instale as dependências:
   ```
   npm install
   ```
2. Copie o arquivo `.env.example` para `.env` e ajuste as variáveis.
3. Inicie o backend:
   ```
   npm run dev
   ```

A API estará disponível em http://localhost:4000

## Estrutura inicial
- index.js: ponto de entrada Express
- Adicione suas rotas em arquivos separados conforme crescer

## Próximos passos
- Implementar autenticação (JWT ou Firebase)
- Criar rotas REST para entidades (clientes, animais, etc)
- Migrar funções customizadas para rotas Express

---

## Variáveis de Ambiente

```
PORT=4000
JWT_SECRET=sua_senha_secreta
GOOGLE_MAPS_API_KEY=sua_chave_google
```

- **PORT**: Porta do servidor Express (padrão: 4000)
- **JWT_SECRET**: Segredo para assinar tokens JWT (troque em produção)
- **GOOGLE_MAPS_API_KEY**: Chave da API do Google Maps (opcional, para cálculo de distância)

---

## Rotas Principais (todas protegidas por JWT)

### Autenticação
- `POST /api/auth/login` — Login (body: email, password)
- `GET /api/auth/me` — Dados do usuário autenticado

### Clientes
- `GET /api/clients` — Listar clientes
- `GET /api/clients/:id` — Detalhe do cliente
- `POST /api/clients` — Criar cliente
- `PUT /api/clients/:id` — Atualizar cliente
- `DELETE /api/clients/:id` — Remover cliente

### Animais
- `GET /api/animals` — Listar animais
- `GET /api/animals/:id` — Detalhe do animal
- `POST /api/animals` — Criar animal
- `PUT /api/animals/:id` — Atualizar animal
- `DELETE /api/animals/:id` — Remover animal

### Agendamentos
- `GET /api/appointments` — Listar agendamentos
- `GET /api/appointments/:id` — Detalhe do agendamento
- `POST /api/appointments` — Criar agendamento
- `PUT /api/appointments/:id` — Atualizar agendamento
- `DELETE /api/appointments/:id` — Remover agendamento

### Usuários
- `GET /api/users` — Listar usuários
- `GET /api/users/:id` — Detalhe do usuário
- `POST /api/users` — Criar usuário
- `PUT /api/users/:id` — Atualizar usuário
- `DELETE /api/users/:id` — Remover usuário

### Propriedades
- `GET /api/properties` — Listar propriedades
- `GET /api/properties/:id` — Detalhe da propriedade
- `POST /api/properties` — Criar propriedade
- `PUT /api/properties/:id` — Atualizar propriedade
- `DELETE /api/properties/:id` — Remover propriedade

### Utilidades
- `POST /api/utils/calculate-distance` — Calcular distância entre endereços
  - Body: `{ propertyAddress, propertyCity, propertyState, manualDistance?, vetProfile: { address, city, state } }`

---

> Todas as rotas (exceto login) exigem o header: `Authorization: Bearer SEU_TOKEN`

---

Se precisar de exemplos de requisição ou quiser documentar outras rotas, só avisar!
