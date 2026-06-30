package db

import (
	"context"
	"encoding/json"
	"log"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/auth"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EnsureBootstrapUser creates or updates the configured director account.
func EnsureBootstrapUser(ctx context.Context, pool *pgxpool.Pool, email, password, name string) {
	hash, err := auth.HashPassword(password)
	if err != nil {
		log.Printf("bootstrap user: hash error: %v", err)
		return
	}

	perms, _ := json.Marshal(auth.DefaultPermissions(models.RoleDirector))

	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists); err != nil {
		log.Printf("bootstrap user: %v", err)
		return
	}

	if exists {
		_, err = pool.Exec(ctx, `
			UPDATE users
			SET password_hash = $1, role = 'director', permissions = $2, name = $3,
			    is_active = TRUE, updated_at = NOW()
			WHERE LOWER(email) = LOWER($4)
		`, hash, perms, name, email)
		if err != nil {
			log.Printf("bootstrap user update: %v", err)
		}
		return
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO users (name, email, password_hash, role, permissions)
		VALUES ($1, $2, $3, $4, $5)
	`, name, email, hash, models.RoleDirector, perms)
	if err != nil {
		log.Printf("bootstrap user: %v", err)
		return
	}
	log.Printf("bootstrap director created: %s", email)
}
