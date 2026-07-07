package handlers

import (
	"fmt"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type analyticsScope struct {
	ShopID    string
	CashierID *uuid.UUID
	Director  bool
}

func scopeFromRequest(c *gin.Context) analyticsScope {
	claims := middleware.GetClaims(c)
	sc := analyticsScope{Director: claims != nil && claims.Role == models.RoleDirector}
	if claims == nil {
		sc.ShopID = c.Query("shop_id")
		return sc
	}
	if sc.Director {
		sc.ShopID = c.Query("shop_id")
		return sc
	}
	uid := claims.UserID
	sc.CashierID = &uid
	if claims.ShopID != nil {
		sc.ShopID = claims.ShopID.String()
	} else {
		sc.ShopID = c.Query("shop_id")
	}
	return sc
}

// txnFilters returns SQL fragments for sales_transactions (alias st) and sales_orders.
func txnFilters(sc analyticsScope, stAlias string) (stClause string, orderClause string, args []interface{}) {
	n := 1
	prefix := ""
	if stAlias != "" {
		prefix = stAlias + "."
	}
	if sc.ShopID != "" {
		stClause += fmt.Sprintf(" AND %sshop_id = $%d", prefix, n)
		orderClause += fmt.Sprintf(" AND shop_id = $%d", n)
		args = append(args, sc.ShopID)
		n++
	}
	if sc.CashierID != nil {
		stClause += fmt.Sprintf(" AND %scashier_id = $%d", prefix, n)
		orderClause += fmt.Sprintf(" AND cashier_id = $%d", n)
		args = append(args, *sc.CashierID)
	}
	return stClause, orderClause, args
}
