package middleware

import (
	"net/http"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/auth"
	"github.com/gin-gonic/gin"
)

// RequireSuperAdmin restricts routes to the bootstrap director (Charles).
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil || !auth.IsSuperAdmin(claims.Email) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "super admin access required"})
			return
		}
		c.Next()
	}
}
