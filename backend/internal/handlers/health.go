package handlers

import (
	"net/http"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	DB     *pgxpool.Pool
	Config config.Config
}

func New(db *pgxpool.Pool, cfg config.Config) *Handler {
	return &Handler{DB: db, Config: cfg}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "prince-esquire-pos",
		"brand":   "Prince Esquire",
	})
}
