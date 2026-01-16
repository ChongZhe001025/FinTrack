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
			{ID: primitive.NewObjectID(), Name: "🍛 餐飲", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🚘 交通", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🛍️ 購物", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🏠 居住", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🎬 娛樂", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "💊 醫療", Type: "expense", Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "💰 薪水", Type: "income", Owner: currentUser},
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

// UpdateCategory 修改類別名稱
func UpdateCategory(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	var input struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	catCollection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var oldCategory models.Category
	err = catCollection.FindOne(ctx, bson.M{"_id": objID, "owner": currentUser}).Decode(&oldCategory)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到類別"})
		return
	}

	// 只能修改自己的類別
	filter := bson.M{"_id": objID, "owner": currentUser}
	update := bson.M{"$set": bson.M{"name": input.Name}}

	result, err := catCollection.UpdateOne(ctx, filter, update)
	if err != nil || result.MatchedCount == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改失敗或無權限"})
		return
	}

	if oldCategory.Name != input.Name {
		transCollection := config.GetCollection("transactions")
		budgetCollection := config.GetCollection("budgets")

		transCollection.UpdateMany(ctx,
			bson.M{"category": oldCategory.Name, "owner": currentUser},
			bson.M{"$set": bson.M{"category": input.Name}},
		)

		budgetCollection.UpdateMany(ctx,
			bson.M{"category": oldCategory.Name, "owner": currentUser},
			bson.M{"$set": bson.M{"category": input.Name}},
		)
	}

	c.JSON(http.StatusOK, gin.H{"message": "修改成功", "name": input.Name})
}

// DeleteCategory 刪除類別
func DeleteCategory(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 只能刪除自己的類別
	filter := bson.M{"_id": objID, "owner": currentUser}

	result, err := collection.DeleteOne(ctx, filter)
	if err != nil || result.DeletedCount == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刪除失敗或無權限"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "刪除成功"})
}
