.PHONY: dev-db dev-api dev-web migrate

dev-db:
	docker compose up -d postgres redis

migrate:
	psql "postgres://prince:prince_dev@localhost:5432/prince_pos?sslmode=disable" -f backend/migrations/001_initial_schema.sql
	psql "postgres://prince:prince_dev@localhost:5432/prince_pos?sslmode=disable" -f backend/migrations/002_seed_categories.sql
	psql "postgres://prince:prince_dev@localhost:5432/prince_pos?sslmode=disable" -f backend/migrations/003_auth_permissions.sql
	psql "postgres://prince:prince_dev@localhost:5432/prince_pos?sslmode=disable" -f backend/migrations/005_discounts.sql
	psql "postgres://prince:prince_dev@localhost:5432/prince_pos?sslmode=disable" -f backend/migrations/006_checkout.sql
	psql "postgres://prince:prince_dev@localhost:5432/prince_pos?sslmode=disable" -f backend/migrations/007_expenses.sql
	psql "postgres://prince:prince_dev@localhost:5432/prince_pos?sslmode=disable" -f backend/migrations/009_subcategory_products.sql

dev-api:
	cd backend && go run ./cmd/server

dev-web:
	cd frontend && npm run dev
