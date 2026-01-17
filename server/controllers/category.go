package controllers

import (
	"context"
	"net/http"
	"server/config"
	"server/models"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetCategories 取得所有類別
func GetCategories(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"owner": currentUser}
	opts := options.Find().SetSort(bson.D{{Key: "order", Value: 1}, {Key: "name", Value: 1}})
	cursor, err := collection.Find(ctx, filter, opts)
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
			{ID: primitive.NewObjectID(), Name: "🍛 餐飲", Type: "expense", Order: 1, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🚘 交通", Type: "expense", Order: 2, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🛍️ 購物", Type: "expense", Order: 3, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🏠 居住", Type: "expense", Order: 4, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🎬 娛樂", Type: "expense", Order: 5, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "💊 醫療", Type: "expense", Order: 6, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "💰 薪水", Type: "income", Order: 7, Owner: currentUser},
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

	if input.Order <= 0 {
		var last models.Category
		err := collection.FindOne(
			ctx,
			bson.M{"owner": currentUser},
			options.FindOne().SetSort(bson.D{{Key: "order", Value: -1}}),
		).Decode(&last)
		if err != nil && err != mongo.ErrNoDocuments {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "無法取得排序資訊"})
			return
		}
		if err == mongo.ErrNoDocuments {
			input.Order = 1
		} else {
			input.Order = last.Order + 1
		}
	}

	_, err := collection.InsertOne(ctx, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法寫入資料庫"})
		return
	}
	c.JSON(http.StatusOK, input)
}

// UpdateCategory 修改類別內容
func UpdateCategory(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	var input struct {
		Name  *string `json:"name"`
		Type  *string `json:"type"`
		Order *int    `json:"order"`
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

	updateFields := bson.M{}
	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "名稱不可為空"})
			return
		}
		updateFields["name"] = trimmed
	}
	if input.Type != nil {
		if *input.Type != "income" && *input.Type != "expense" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type 必須是 income 或 expense"})
			return
		}
		updateFields["type"] = *input.Type
	}
	if input.Order != nil {
		if *input.Order < 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "order 必須大於 0"})
			return
		}
		updateFields["order"] = *input.Order
	}
	if len(updateFields) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "沒有要更新的欄位"})
		return
	}

	// 只能修改自己的類別
	filter := bson.M{"_id": objID, "owner": currentUser}
	update := bson.M{"$set": updateFields}

	result, err := catCollection.UpdateOne(ctx, filter, update)
	if err != nil || result.MatchedCount == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改失敗或無權限"})
		return
	}

	newName := oldCategory.Name
	if input.Name != nil {
		newName = strings.TrimSpace(*input.Name)
	}
	if oldCategory.Name != newName {
		budgetCollection := config.GetCollection("budgets")

		budgetCollection.UpdateMany(ctx,
			bson.M{"category": oldCategory.Name, "owner": currentUser},
			bson.M{"$set": bson.M{"category": newName}},
		)
	}

	c.JSON(http.StatusOK, gin.H{"message": "修改成功"})
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
