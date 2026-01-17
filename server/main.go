package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"server/config"
	"server/controllers"
	_ "server/docs"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// 1. 設定 Gin 模式 (生產環境切換為 Release Mode)
	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	config.ConnectDB()

	r := GinRouter()

	// 2. 動態獲取 Port (雲端平台通常會透過環境變數 PORT 指定)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // 本機開發預設
	}

	r.Run(":" + port)
}

func GinRouter() *gin.Engine {
	r := gin.Default()

	// 3. 處理 CORS (跨域問題)
	// 讀取環境變數中的允許網域，例如 "https://fintrack.com,http://localhost:5173"
	allowOrigins := os.Getenv("ALLOWED_ORIGINS")
	var origins []string

	if allowOrigins == "" {
		// 如果沒設定，預設只允許本機 (開發用)
		origins = []string{"http://localhost:5173"}
	} else {
		// 支援多個來源，用逗號分隔
		origins = strings.Split(allowOrigins, ",")
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// 4. (選用) 可以考慮在生產環境關閉 Swagger，或加上帳號密碼驗證
	// if os.Getenv("GIN_MODE") != "release" {
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	// }

	v1 := r.Group("/api/v1")
	{
		v1.GET("/ping", controllers.Ping)

		auth := v1.Group("/auth")
		{
			auth.POST("/login", controllers.Login)
			auth.POST("/logout", controllers.Logout)
			auth.GET("/me", controllers.CheckAuth)
		}

		protected := v1.Group("/")
		protected.Use(controllers.AuthRequired)
		{
			// Transaction CRUD
			protected.POST("/transactions", controllers.CreateTransaction)
			protected.GET("/transactions", controllers.GetTransactions)
			protected.PUT("/transactions/:id", controllers.UpdateTransaction)
			protected.DELETE("/transactions/:id", controllers.DeleteTransaction)

			// Stats
			protected.GET("/stats", controllers.GetDashboardStats)
			protected.GET("/stats/category", controllers.GetCategoryStats)
			protected.GET("/stats/comparison", controllers.GetMonthlyComparison)
			protected.GET("/stats/weekly", controllers.GetWeeklyHabits)
			protected.GET("/reports/yearly", controllers.GetYearlyReport)

			// Category
			protected.GET("/categories", controllers.GetCategories)
			protected.POST("/categories", controllers.CreateCategory)
			protected.PUT("/categories/:id", controllers.UpdateCategory)
			protected.DELETE("/categories/:id", controllers.DeleteCategory)

			// Budgets
			protected.POST("/budgets", controllers.SetBudget)
			protected.GET("/budgets/status", controllers.GetBudgetStatus)
			protected.DELETE("/budgets/:id", controllers.DeleteBudget)
		}
	}

	registerStaticRoutes(r)

	return r
}

func registerStaticRoutes(r *gin.Engine) {
	staticDir := "./public"
	indexPath := filepath.Join(staticDir, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		return
	}

	r.Static("/assets", filepath.Join(staticDir, "assets"))
	r.StaticFile("/logo.png", filepath.Join(staticDir, "logo.png"))
	r.StaticFile("/vite.svg", filepath.Join(staticDir, "vite.svg"))

	r.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.Status(http.StatusNotFound)
			return
		}
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.Status(http.StatusNotFound)
			return
		}

		c.File(indexPath)
	})
}
