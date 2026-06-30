package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type createCategoryRequest struct {
	Name         string   `json:"name" binding:"required"`
	ParentID     *string  `json:"parent_id"`
	VariantTypes []string `json:"variant_types"`
}

type updateCategoryRequest struct {
	Name         *string  `json:"name"`
	ParentID     *string  `json:"parent_id"`
	VariantTypes []string `json:"variant_types"`
}

func (h *Handler) CreateCategory(c *gin.Context) {
	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var parentID *uuid.UUID
	if req.ParentID != nil && *req.ParentID != "" {
		id, err := uuid.Parse(*req.ParentID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid parent_id"})
			return
		}
		parentID = &id
	}

	variantTypes := req.VariantTypes
	if len(variantTypes) == 0 {
		variantTypes = []string{"size", "color"}
	}
	vtJSON, _ := json.Marshal(variantTypes)

	slug := slugify(req.Name)
	var exists bool
	_ = h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM categories WHERE slug = $1)`, slug).Scan(&exists)
	if exists {
		slug = slug + "-" + uuid.New().String()[:8]
	}

	var id uuid.UUID
	err := h.DB.QueryRow(c.Request.Context(), `
		INSERT INTO categories (name, slug, parent_id, variant_types)
		VALUES ($1, $2, $3, $4::jsonb)
		RETURNING id
	`, req.Name, slug, parentID, string(vtJSON)).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create failed"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id.String(), "slug": slug})
}

func (h *Handler) UpdateCategory(c *gin.Context) {
	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category id"})
		return
	}

	var req updateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var parentArg interface{}
	updateParent := false
	if req.ParentID != nil {
		updateParent = true
		if *req.ParentID == "" {
			parentArg = nil
		} else {
			id, err := uuid.Parse(*req.ParentID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid parent_id"})
				return
			}
			if id == catID {
				c.JSON(http.StatusBadRequest, gin.H{"error": "category cannot be its own parent"})
				return
			}
			parentArg = id
		}
	}

	var vtJSON *string
	if req.VariantTypes != nil {
		b, _ := json.Marshal(req.VariantTypes)
		s := string(b)
		vtJSON = &s
	}

	var slug *string
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		s := slugify(*req.Name)
		slug = &s
	}

	if updateParent {
		_, err = h.DB.Exec(c.Request.Context(), `
			UPDATE categories SET
				name = COALESCE($1, name),
				slug = COALESCE($2, slug),
				parent_id = $3,
				variant_types = COALESCE($4::jsonb, variant_types)
			WHERE id = $5
		`, req.Name, slug, parentArg, vtJSON, catID)
	} else {
		_, err = h.DB.Exec(c.Request.Context(), `
			UPDATE categories SET
				name = COALESCE($1, name),
				slug = COALESCE($2, slug),
				variant_types = COALESCE($3::jsonb, variant_types)
			WHERE id = $4
		`, req.Name, slug, vtJSON, catID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "update failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"updated": true})
}

func (h *Handler) DeleteCategory(c *gin.Context) {
	catID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid category id"})
		return
	}

	var childCount, productCount int
	_ = h.DB.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM categories WHERE parent_id = $1`, catID).Scan(&childCount)
	_ = h.DB.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM products WHERE category_id = $1`, catID).Scan(&productCount)

	if childCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "category has subcategories — remove or reassign them first"})
		return
	}
	if productCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "category has products — move or delete products first"})
		return
	}

	_, err = h.DB.Exec(c.Request.Context(), `DELETE FROM categories WHERE id = $1`, catID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "delete failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"deleted": true})
}
