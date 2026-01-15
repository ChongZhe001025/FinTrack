package main

import (
	"context"
	"server/config"
	"server/controllers"
	_ "server/docs"
	"server/models"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func main() {
	config.ConnectDB()

	// 初始化預設類別種子資料
	seedCategories()

	r := GinRouter()
	r.Run(":8080")
}

func seedCategories() {
	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 檢查是否已經有類別
	count, _ := collection.CountDocuments(ctx, bson.M{})
	if count == 0 {
		// 如果是空的，寫入預設資料
		defaults := []interface{}{
			models.Category{ID: primitive.NewObjectID(), Name: "Food", Type: "expense"},
			models.Category{ID: primitive.NewObjectID(), Name: "Transport", Type: "expense"},
			models.Category{ID: primitive.NewObjectID(), Name: "Shopping", Type: "expense"},
			models.Category{ID: primitive.NewObjectID(), Name: "Housing", Type: "expense"},
			models.Category{ID: primitive.NewObjectID(), Name: "Entertainment", Type: "expense"},
			models.Category{ID: primitive.NewObjectID(), Name: "Medical", Type: "expense"},
			models.Category{ID: primitive.NewObjectID(), Name: "Salary", Type: "income"},
		}
		collection.InsertMany(ctx, defaults)
		println("🌱 預設類別已初始化！")
	}
}

func GinRouter() *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	v1 := r.Group("/api/v1")
	{
		v1.GET("/ping", controllers.Ping)

		// Transaction CRUD
		v1.POST("/transactions", controllers.CreateTransaction)
		v1.GET("/transactions", controllers.GetTransactions)
		v1.PUT("/transactions/:id", controllers.UpdateTransaction)    // 新增修改
		v1.DELETE("/transactions/:id", controllers.DeleteTransaction) // 新增刪除

		// Stats
		v1.GET("/stats", controllers.GetDashboardStats)
		v1.GET("/stats/category", controllers.GetCategoryStats)

		// Category
		v1.GET("/categories", controllers.GetCategories)
		v1.POST("/categories", controllers.CreateCategory)
	}

	return r
}
