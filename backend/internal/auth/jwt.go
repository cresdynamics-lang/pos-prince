package auth

import (
	"errors"
	"time"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID      uuid.UUID       `json:"user_id"`
	Email       string          `json:"email"`
	Role        models.UserRole `json:"role"`
	ShopID      *uuid.UUID      `json:"shop_id,omitempty"`
	Permissions []string        `json:"permissions"`
	jwt.RegisteredClaims
}

func IssueToken(secret string, user models.User, perms []string, ttl time.Duration) (string, error) {
	claims := Claims{
		UserID:      user.ID,
		Email:       user.Email,
		Role:        user.Role,
		ShopID:      user.ShopID,
		Permissions: perms,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(secret, tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
