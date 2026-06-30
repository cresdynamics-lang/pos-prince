package auth

import (
	"os"
	"strings"
)

const defaultSuperAdminEmail = "charles@prince-esquire.co.ke"

// SuperAdminEmail is the sole account allowed to manage users and hold full director access.
func SuperAdminEmail() string {
	if v := os.Getenv("BOOTSTRAP_ADMIN_EMAIL"); v != "" {
		return strings.ToLower(strings.TrimSpace(v))
	}
	return defaultSuperAdminEmail
}

func IsSuperAdmin(email string) bool {
	return strings.ToLower(strings.TrimSpace(email)) == SuperAdminEmail()
}
