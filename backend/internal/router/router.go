package router

import (
	"github.com/cresdynamics-lang/pos-prince/backend/internal/config"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/handlers"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func New(pool *pgxpool.Pool, cfg config.Config) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), middleware.CORS(cfg))

	h := handlers.New(pool)

	r.GET("/api/health", h.Health)

	api := r.Group("/api/v1")
	{
		api.GET("/categories", h.ListCategories)
		api.GET("/shops", h.ListShops)
		api.GET("/shops/:id/inventory", h.GetShopInventory)
	}

	return r
}
