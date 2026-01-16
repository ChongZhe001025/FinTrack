package controllers

import (
	"context"
	"net/http"
	"server/config"
	"server/models"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GetCategories 取得所有類別
func GetCategories(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"owner": currentUser}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取類別"})
		return
	}
	defer cursor.Close(ctx)

	var categories []models.Category
	if err = cursor.All(ctx, &categories); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析失敗"})
		return
	}

	if len(categories) == 0 {
		defaults := []models.Category{
			{ID: primitive.NewObjectID(), Name: "Food", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "Transport", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "Shopping", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "Housing", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "Entertainment", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "Medical", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "Salary", Type: "income", Owner: currentUser},
		}

		var docs []interface{}
		for _, d := range defaults {
			docs = append(docs, d)
		}

		if _, err := collection.InsertMany(ctx, docs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "無法初始化預設類別"})
			return
		}

		c.JSON(http.StatusOK, defaults)
		return
	}

	c.JSON(http.StatusOK, categories)
}

// CreateCategory 新增類別
func CreateCategory(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	var input models.Category
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.ID = primitive.NewObjectID()
	input.Owner = currentUser
	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法寫入資料庫"})
		return
	}
	c.JSON(http.StatusOK, input)
}
