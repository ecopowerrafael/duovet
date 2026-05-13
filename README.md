e.g.
## Duo Vet - Projeto Independente

**Sobre**

Este projeto contém tudo que você precisa para rodar o app localmente, sem dependências Base44.

**Como rodar localmente**

1. Clone o repositório
2. Navegue até o diretório do projeto
3. Instale as dependências:
	 ```
	 npm install
	 ```
4. Crie um arquivo `.env.local` ou `.env` com as variáveis:
	 ```
	 PORT=4000
	 JWT_SECRET=sua_senha_secreta
	 GOOGLE_MAPS_API_KEY=sua_chave_google
	 ```
5. Inicie o backend:
	 ```
	 npm run dev
	 ```

O app estará disponível em http://localhost:4000

**Rotas principais (Express API)**

- Autenticação:
	- `POST /api/auth/login` — Login (body: email, password)
	- `GET /api/auth/me` — Dados do usuário autenticado
- Clientes:
	- `GET /api/clients` — Listar clientes
	- `GET /api/clients/:id` — Detalhe do cliente
	- `POST /api/clients` — Criar cliente
	- `PUT /api/clients/:id` — Atualizar cliente
	- `DELETE /api/clients/:id` — Remover cliente
- Animais:
	- `GET /api/animals` — Listar animais
	- `GET /api/animals/:id` — Detalhe do animal
	- `POST /api/animals` — Criar animal
	- `PUT /api/animals/:id` — Atualizar animal
	- `DELETE /api/animals/:id` — Remover animal
- Agendamentos:
	- `GET /api/appointments` — Listar agendamentos
	- `GET /api/appointments/:id` — Detalhe do agendamento
	- `POST /api/appointments` — Criar agendamento
	- `PUT /api/appointments/:id` — Atualizar agendamento
	- `DELETE /api/appointments/:id` — Remover agendamento
- Usuários:
	- `GET /api/users` — Listar usuários
	- `GET /api/users/:id` — Detalhe do usuário
	- `POST /api/users` — Criar usuário
	- `PUT /api/users/:id` — Atualizar usuário
	- `DELETE /api/users/:id` — Remover usuário
- Propriedades:
	- `GET /api/properties` — Listar propriedades
	- `GET /api/properties/:id` — Detalhe da propriedade
	- `POST /api/properties` — Criar propriedade
	- `PUT /api/properties/:id` — Atualizar propriedade
	- `DELETE /api/properties/:id` — Remover propriedade
- Utilidades:
	- `POST /api/utils/calculate-distance` — Calcular distância entre endereços
		- Body: `{ propertyAddress, propertyCity, propertyState, manualDistance?, vetProfile: { address, city, state } }`

> Todas as rotas (exceto login) exigem o header: `Authorization: Bearer SEU_TOKEN`

---

Se precisar de exemplos de requisição ou quiser documentar outras rotas, só avisar!
