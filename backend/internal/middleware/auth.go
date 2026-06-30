package middleware

import (
	"net/http"
	"strings"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/auth"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/config"
	"github.com/gin-gonic/gin"
)

const claimsKey = "claims"

func AuthRequired(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}
		token := strings.TrimPrefix(header, "Bearer ")
		claims, err := auth.ParseToken(cfg.JWTSecret, token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		c.Set(claimsKey, claims)
		c.Next()
	}
}

func RequirePermission(perm string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := c.Get(claimsKey)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}
		claims := raw.(*auth.Claims)
		if !auth.HasPermission(claims.Permissions, perm) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}

func RequireAnyPermission(perms ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw, ok := c.Get(claimsKey)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}
		claims := raw.(*auth.Claims)
		if !auth.HasAnyPermission(claims.Permissions, perms...) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			return
		}
		c.Next()
	}
}

func GetClaims(c *gin.Context) *auth.Claims {
	raw, _ := c.Get(claimsKey)
	if raw == nil {
		return nil
	}
	return raw.(*auth.Claims)
}
