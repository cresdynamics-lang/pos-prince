package main

import (
	"log"

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

	r := router.New(pool, cfg)
	addr := ":" + cfg.Port
	log.Printf("Prince Esquire POS API listening on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
