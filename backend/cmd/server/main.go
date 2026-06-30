package main

import (
	"context"
	"log"
	"os"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/config"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/db"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/router"
)

func main() {
	cfg := config.Load()
	pool, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	email := os.Getenv("BOOTSTRAP_ADMIN_EMAIL")
	if email == "" {
		email = "charles@prince-esquire.co.ke"
	}
	pass := os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")
	if pass == "" {
		pass = "C.Mutunga"
	}
	name := os.Getenv("BOOTSTRAP_ADMIN_NAME")
	if name == "" {
		name = "Charles Mutunga"
	}
	db.EnsureBootstrapUser(context.Background(), pool, email, pass, name)
	db.EnsureDemoCatalog(context.Background(), pool)

	r := router.New(pool, cfg)
	addr := ":" + cfg.Port
	log.Printf("Prince Esquire POS API listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
