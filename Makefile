.PHONY: dev-db dev-api dev-web migrate

dev-db:
	docker compose up -d postgres redis

migrate:
	psql "postgres://prince:prince_dev@localhost:5433/prince_pos?sslmode=disable" -f backend/migrations/001_initial_schema.sql
	psql "postgres://prince:prince_dev@localhost:5433/prince_pos?sslmode=disable" -f backend/migrations/002_seed_categories.sql

dev-api:
	cd backend && go run ./cmd/server

dev-web:
	cd frontend && npm run dev
