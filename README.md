# Prince Esquire POS

Multi-shop point-of-sale system for **Prince Esquire** — concurrent stock management, inter-shop transfers, and retail sales across fashion categories.

**Contact:** 0724-494089 · prince-esquire@gmail.com · [prince-esquire.co.ke](https://prince-esquire.co.ke)

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Go + [Gin](https://github.com/gin-gonic/gin) |
| Database | PostgreSQL |
| Query layer | pgx (sqlc-ready SQL in `backend/sql/`) |
| Cache / sessions | Redis |
| Frontend | Next.js + Tailwind CSS (neumorphism UI) |
| Real-time | WebSockets (live stock updates) |
| Auth | JWT + RBAC (Director, Shop Manager, Cashier) |
| Deploy | Docker + Nginx |

## Project structure

```
pos-prince/
├── backend/          # Go API
├── frontend/         # Next.js POS & dashboard
├── docker-compose.yml
└── README.md
```

## Quick start

### Prerequisites

- [Go 1.22+](https://go.dev/dl/)
- Node.js 20+
- Docker (for PostgreSQL & Redis)

### 1. Start infrastructure

```bash
docker compose up -d postgres redis
```

### 2. Run migrations

```bash
psql "$DATABASE_URL" -f backend/migrations/001_initial_schema.sql
psql "$DATABASE_URL" -f backend/migrations/002_seed_categories.sql
```

### 3. Backend

```bash
cd backend
cp .env.example .env
go mod download
go run ./cmd/server
```

API: `http://localhost:8080` · Health: `GET /api/health`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:3000`

## Roles

| Role | Access |
|------|--------|
| **Director** | All shops, reports, marketing ROI |
| **Shop Manager** | Assigned shop — inventory, transfers, staff |
| **Cashier** | POS sales, stock visibility, transfer requests |

## Product categories

Full two-level tree: Polo T-Shirts, Shoes, Shirts, Suits, Blazers, Track Suits, Jackets, Trousers, Linen, Caps & Hats, Belts & Ties, Sweaters, T-Shirts — each with subcategories and category-specific variant attributes (size, color, material, etc.).

## Still needed from client

1. Excel catalog with live product names and pricing (seed data)
2. Number of active shop locations
3. Confirm official brand name: **Prince Esquire** vs Prince Square
4. Whether offline POS is required during internet outages

## License

MIT — see [LICENSE](LICENSE).
