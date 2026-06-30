package handlers

import (
	"net/http"
	"sort"

	"github.com/cresdynamics-lang/pos-prince/backend/internal/models"
	"github.com/gin-gonic/gin"
)

func (h *Handler) ListCategories(c *gin.Context) {
	rows, err := h.DB.Query(c.Request.Context(), `
		SELECT id, name, slug, parent_id, variant_types, created_at
		FROM categories
		ORDER BY name
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load categories"})
		return
	}
	defer rows.Close()

	byID := make(map[string]*models.Category)
	for rows.Next() {
		var cat models.Category
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.Slug, &cat.ParentID, &cat.VariantTypes, &cat.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse categories"})
			return
		}
		cat.Children = []models.Category{}
		copy := cat
		byID[cat.ID.String()] = &copy
	}

	var roots []*models.Category
	for _, cat := range byID {
		if cat.ParentID == nil {
			roots = append(roots, cat)
			continue
		}
		parent, ok := byID[cat.ParentID.String()]
		if !ok {
			roots = append(roots, cat)
			continue
		}
		parent.Children = append(parent.Children, *cat)
	}

	sort.Slice(roots, func(i, j int) bool { return roots[i].Name < roots[j].Name })
	out := make([]models.Category, 0, len(roots))
	for _, r := range roots {
		sort.Slice(r.Children, func(i, j int) bool { return r.Children[i].Name < r.Children[j].Name })
		out = append(out, *r)
	}

	c.JSON(http.StatusOK, gin.H{"categories": out})
}
