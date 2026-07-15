package router

import (
	"github.com/cresdynamics-lang/pos-prince/backend/internal/auth"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/config"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/handlers"
	"github.com/cresdynamics-lang/pos-prince/backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func New(pool *pgxpool.Pool, cfg config.Config) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger(), middleware.CORS(cfg))

	h := handlers.New(pool, cfg)

	r.GET("/api/health", h.Health)

	api := r.Group("/api/v1")
	{
		api.POST("/auth/login", h.Login)

		protected := api.Group("")
		protected.Use(middleware.AuthRequired(cfg))
		{
			protected.GET("/auth/me", h.Me)
			protected.GET("/categories", h.ListCategories)
			protected.POST("/categories", middleware.RequirePermission(auth.PermInventoryE), h.CreateCategory)
			protected.PATCH("/categories/:id", middleware.RequirePermission(auth.PermInventoryE), h.UpdateCategory)
			protected.DELETE("/categories/:id", middleware.RequirePermission(auth.PermInventoryE), h.DeleteCategory)

			protected.GET("/products", middleware.RequirePermission(auth.PermInventory), h.ListProducts)
			protected.POST("/products", middleware.RequirePermission(auth.PermInventoryE), h.CreateProduct)
			protected.PATCH("/products/:id", middleware.RequirePermission(auth.PermInventoryE), h.UpdateProduct)
			protected.DELETE("/products/:id", middleware.RequirePermission(auth.PermInventoryE), h.DeleteProduct)
			protected.GET("/shops", h.ListShops)
			protected.POST("/shops", middleware.RequirePermission(auth.PermStoresE), h.CreateShop)
			protected.PATCH("/shops/:id", middleware.RequirePermission(auth.PermStoresE), h.UpdateShop)
			protected.DELETE("/shops/:id", middleware.RequirePermission(auth.PermStoresE), h.DeleteShop)

	variantRead := middleware.RequireAnyPermission(auth.PermInventory, auth.PermSales, auth.PermSalesC)

			protected.GET("/inventory", middleware.RequirePermission(auth.PermInventory), h.ListInventory)
			protected.POST("/inventory/add", middleware.RequirePermission(auth.PermInventoryE), h.AddStock)
			protected.POST("/inventory/set", middleware.RequireAnyPermission(auth.PermInventoryE, auth.PermSalesC), h.SetStock)
			protected.POST("/variants", middleware.RequireAnyPermission(auth.PermInventoryE, auth.PermSalesC), h.CreateVariant)
			protected.GET("/variants", variantRead, h.ListProductVariants)
			protected.GET("/variants/:id", variantRead, h.GetVariantDetail)

			protected.GET("/transfers", middleware.RequirePermission(auth.PermInventory), h.ListTransfers)
			protected.POST("/transfers", middleware.RequirePermission(auth.PermInventoryE), h.CreateTransfer)
			protected.POST("/stores/sync-catalog", middleware.RequirePermission(auth.PermInventoryE), h.SyncStoreCatalog)
			protected.GET("/shops/:id/inventory", middleware.RequirePermission(auth.PermInventory), h.GetShopInventory)

			protected.GET("/analytics/dashboard", middleware.RequirePermission(auth.PermDashboard), h.DashboardAnalytics)
			protected.GET("/analytics/revenue", middleware.RequirePermission(auth.PermRevenue), h.RevenueAnalytics)
			protected.GET("/reports/day", middleware.RequirePermission(auth.PermAnalytics), h.DayReport)
			protected.GET("/activity", middleware.RequirePermission(auth.PermAnalytics), h.ListActivity)
			protected.GET("/finance/overview", middleware.RequirePermission(auth.PermFinance), h.FinanceOverview)

			protected.GET("/expenses", middleware.RequireAnyPermission(auth.PermFinance, auth.PermRevenue, auth.PermSales), h.ListExpenses)
			protected.POST("/expenses", middleware.RequireAnyPermission(auth.PermFinanceE, auth.PermSalesC), h.CreateExpense)
			protected.DELETE("/expenses/:id", middleware.RequireAnyPermission(auth.PermFinanceE, auth.PermSalesC), h.DeleteExpense)

			protected.GET("/daily-notes", middleware.RequireAnyPermission(auth.PermFinance, auth.PermRevenue, auth.PermSales), h.ListDailyNotes)
			protected.POST("/daily-notes", middleware.RequireAnyPermission(auth.PermFinanceE, auth.PermSalesC), h.UpsertDailyNote)

			protected.GET("/sales", middleware.RequirePermission(auth.PermSales), h.SalesList)
			protected.POST("/sales", middleware.RequirePermission(auth.PermSalesC), h.CreateSale)
			protected.POST("/sales/checkout", middleware.RequirePermission(auth.PermSalesC), h.CheckoutSale)

			protected.GET("/users", middleware.RequirePermission(auth.PermUsers), h.ListUsers)
			protected.POST("/users", middleware.RequirePermissionOrSuperAdmin(auth.PermUsersC), h.CreateUser)
			protected.PATCH("/users/:id", middleware.RequirePermissionOrSuperAdmin(auth.PermUsersE), h.UpdateUser)
			protected.DELETE("/users/:id", middleware.RequirePermissionOrSuperAdmin(auth.PermUsersE), h.DeleteUser)
		}
	}

	return r
}
