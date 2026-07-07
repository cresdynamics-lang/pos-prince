package auth

import (
	"encoding/json"
	"slices"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
)

const (
	PermDashboard  = "dashboard.view"
	PermAnalytics  = "analytics.view"
	PermInventory  = "inventory.view"
	PermInventoryE = "inventory.edit"
	PermStores     = "stores.view"
	PermStoresE    = "stores.edit"
	PermUsers      = "users.view"
	PermUsersC     = "users.create"
	PermUsersE     = "users.edit"
	PermSales      = "sales.view"
	PermSalesC     = "sales.create"
	PermRevenue    = "revenue.view"
	PermFinance    = "finance.view"
	PermFinanceE   = "finance.edit"
	PermPOS        = "pos.access"
)

var roleDefaults = map[models.UserRole][]string{
	models.RoleDirector: {
		PermDashboard, PermAnalytics, PermInventory, PermInventoryE,
		PermStores, PermStoresE, PermUsers, PermUsersC, PermUsersE,
		PermSales, PermSalesC, PermRevenue, PermFinance, PermFinanceE, PermPOS,
	},
	models.RoleShopManager: {
		PermDashboard, PermAnalytics, PermInventory, PermInventoryE,
		PermStores, PermSales, PermSalesC, PermPOS,
	},
	models.RoleCashier: {
		PermDashboard, PermAnalytics, PermInventory, PermSales, PermSalesC, PermPOS,
	},
}

func DefaultPermissions(role models.UserRole) []string {
	if perms, ok := roleDefaults[role]; ok {
		out := make([]string, len(perms))
		copy(out, perms)
		return out
	}
	return []string{PermPOS}
}

func ResolvePermissions(role models.UserRole, custom json.RawMessage) []string {
	if len(custom) > 0 && string(custom) != "[]" && string(custom) != "null" {
		var perms []string
		if err := json.Unmarshal(custom, &perms); err == nil && len(perms) > 0 {
			return perms
		}
	}
	return DefaultPermissions(role)
}

func HasPermission(perms []string, required string) bool {
	return slices.Contains(perms, required)
}

func HasAnyPermission(perms []string, required ...string) bool {
	for _, r := range required {
		if HasPermission(perms, r) {
			return true
		}
	}
	return false
}
