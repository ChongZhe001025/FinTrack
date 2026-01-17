// controllers/category.go
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
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetCategories 取得所有類別（依 order,name 排序）
func GetCategories(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "order", Value: 1}, {Key: "name", Value: 1}})
	filter := bson.M{"owner": currentUser}

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
			{ID: primitive.NewObjectID(), Name: "🍛 餐飲", Type: "expense", Order: 10, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🚘 交通", Type: "expense", Order: 20, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🛍️ 購物", Type: "expense", Order: 30, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🏠 居住", Type: "expense", Order: 40, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "🎬 娛樂", Type: "expense", Order: 50, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "💊 醫療", Type: "expense", Order: 60, Owner: currentUser},
			{ID: primitive.NewObjectID(), Name: "💰 薪水", Type: "income", Order: 70, Owner: currentUser},
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

	var input struct {
		Name  string `json:"name" binding:"required"`
		Type  string `json:"type"`
		Order *int   `json:"order"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// name unique per owner (soft check;建议再加 unique index)
	if err := collection.FindOne(ctx, bson.M{"owner": currentUser, "name": input.Name}).Err(); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "類別名稱已存在"})
		return
	} else if err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法檢查重複類別"})
		return
	}

	categoryType := input.Type
	if categoryType != "income" && categoryType != "expense" {
		categoryType = "expense"
	}

	order := 1000
	if input.Order != nil {
		order = *input.Order
	}

	category := models.Category{
		ID:    primitive.NewObjectID(),
		Name:  input.Name,
		Type:  categoryType,
		Order: order,
		Owner: currentUser,
	}

	if _, err := collection.InsertOne(ctx, category); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法寫入資料庫"})
		return
	}

	c.JSON(http.StatusOK, category)
}

// UpdateCategory 修改類別（name/type/order）
func UpdateCategory(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	objID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	var input struct {
		Name  string `json:"name" binding:"required"`
		Type  string `json:"type"`
		Order *int   `json:"order"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	catCollection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var oldCategory models.Category
	if err := catCollection.FindOne(ctx, bson.M{"_id": objID, "owner": currentUser}).Decode(&oldCategory); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到類別"})
		return
	}

	// name uniqueness if changed
	if input.Name != oldCategory.Name {
		if err := catCollection.FindOne(ctx, bson.M{
			"owner": currentUser,
			"name":  input.Name,
			"_id":   bson.M{"$ne": objID},
		}).Err(); err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "類別名稱已存在"})
			return
		} else if err != mongo.ErrNoDocuments {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "無法檢查重複類別"})
			return
		}
	}

	updateFields := bson.M{"name": input.Name}

	if input.Type != "" {
		if input.Type != "income" && input.Type != "expense" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type 必須是 income 或 expense"})
			return
		}
		updateFields["type"] = input.Type
	}

	if input.Order != nil {
		updateFields["order"] = *input.Order
	}

	filter := bson.M{"_id": objID, "owner": currentUser}
	if _, err := catCollection.UpdateOne(ctx, filter, bson.M{"$set": updateFields}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改失敗或無權限"})
		return
	}

	// budgets still store category name (string)
	if oldCategory.Name != input.Name {
		budgetCollection := config.GetCollection("budgets")
		_, _ = budgetCollection.UpdateMany(ctx,
			bson.M{"category": oldCategory.Name, "owner": currentUser},
			bson.M{"$set": bson.M{"category": input.Name}},
		)
	}

	c.JSON(http.StatusOK, gin.H{"message": "修改成功"})
}

// DeleteCategory 刪除類別
func DeleteCategory(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	objID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	collection := config.GetCollection("categories")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "owner": currentUser}
	result, err := collection.DeleteOne(ctx, filter)
	if err != nil || result.DeletedCount == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刪除失敗或無權限"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "刪除成功"})
}
