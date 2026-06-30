package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Category struct {
	ID           uuid.UUID       `json:"id"`
	Name         string          `json:"name"`
	Slug         string          `json:"slug"`
	ParentID     *uuid.UUID      `json:"parent_id,omitempty"`
	VariantTypes json.RawMessage `json:"variant_types"`
	Children     []Category      `json:"children,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

type Shop struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	Location  *string    `json:"location,omitempty"`
	Phone     *string    `json:"phone,omitempty"`
	ManagerID *uuid.UUID `json:"manager_id,omitempty"`
	IsActive  bool       `json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
}

type Product struct {
	ID          uuid.UUID  `json:"id"`
	CategoryID  uuid.UUID  `json:"category_id"`
	Name        string     `json:"name"`
	Brand       *string    `json:"brand,omitempty"`
	Description *string    `json:"description,omitempty"`
	BasePrice   float64    `json:"base_price"`
	ImageURL    *string    `json:"image_url,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
}

type ProductVariant struct {
	ID         uuid.UUID `json:"id"`
	ProductID  uuid.UUID `json:"product_id"`
	SKU        string    `json:"sku"`
	Size       *string   `json:"size,omitempty"`
	Color      *string   `json:"color,omitempty"`
	Material   *string   `json:"material,omitempty"`
	SleeveType *string   `json:"sleeve_type,omitempty"`
	Length     *string   `json:"length,omitempty"`
}

type InventoryRow struct {
	ID               uuid.UUID `json:"id"`
	ProductVariantID uuid.UUID `json:"product_variant_id"`
	ShopID           uuid.UUID `json:"shop_id"`
	Quantity         int       `json:"quantity"`
	ReorderThreshold int       `json:"reorder_threshold"`
	SKU              string    `json:"sku,omitempty"`
	ProductName      string    `json:"product_name,omitempty"`
	ShopName         string    `json:"shop_name,omitempty"`
}

type UserRole string

const (
	RoleDirector    UserRole = "director"
	RoleShopManager UserRole = "shop_manager"
	RoleCashier     UserRole = "cashier"
)

type User struct {
	ID          uuid.UUID       `json:"id"`
	Name        string          `json:"name"`
	Email       string          `json:"email"`
	Role        UserRole        `json:"role"`
	ShopID      *uuid.UUID      `json:"shop_id,omitempty"`
	Permissions json.RawMessage `json:"permissions,omitempty"`
	IsActive    bool            `json:"is_active"`
	CreatedAt   time.Time       `json:"created_at,omitempty"`
}

type UserPublic struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	Role         UserRole  `json:"role"`
	ShopID       *uuid.UUID `json:"shop_id,omitempty"`
	Permissions  []string  `json:"permissions"`
	IsActive     bool      `json:"is_active"`
	IsSuperAdmin bool      `json:"is_super_admin"`
	CreatedAt    time.Time `json:"created_at"`
}
