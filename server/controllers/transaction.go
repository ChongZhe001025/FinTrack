// controllers/transaction.go
package controllers

import (
	"context"
	"errors"
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

var (
	errCategoryRequired  = errors.New("category required")
	errCategoryNotFound  = errors.New("category not found")
	errInvalidCategoryID = errors.New("invalid category id")
)

type transactionInput struct {
	Amount     float64 `json:"amount" binding:"required"`
	Category   string  `json:"category"`
	CategoryID string  `json:"category_id"`
	Date       string  `json:"date" binding:"required"`
	Note       string  `json:"note"`
}

func resolveCategoryType(category models.Category) string {
	if category.Type == "income" || category.Type == "expense" {
		return category.Type
	}
	return "expense"
}

// prefer category_id, fallback to name
func resolveCategory(ctx context.Context, owner string, categoryID string, categoryName string) (models.Category, error) {
	collection := config.GetCollection("categories")

	if categoryID != "" {
		objID, err := primitive.ObjectIDFromHex(categoryID)
		if err != nil {
			return models.Category{}, errInvalidCategoryID
		}
		var category models.Category
		if err := collection.FindOne(ctx, bson.M{"_id": objID, "owner": owner}).Decode(&category); err != nil {
			if err == mongo.ErrNoDocuments {
				return models.Category{}, errCategoryNotFound
			}
			return models.Category{}, err
		}
		return category, nil
	}

	if categoryName == "" {
		return models.Category{}, errCategoryRequired
	}

	var category models.Category
	if err := collection.FindOne(ctx, bson.M{"name": categoryName, "owner": owner}).Decode(&category); err != nil {
		if err == mongo.ErrNoDocuments {
			return models.Category{}, errCategoryNotFound
		}
		return models.Category{}, err
	}
	return category, nil
}

// CreateTransaction
func CreateTransaction(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	var input transactionInput

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	category, err := resolveCategory(ctx, currentUser, input.CategoryID, input.Category)
	if err != nil {
		switch err {
		case errCategoryRequired, errInvalidCategoryID:
			c.JSON(http.StatusBadRequest, gin.H{"error": "請提供有效的類別"})
		case errCategoryNotFound:
			c.JSON(http.StatusBadRequest, gin.H{"error": "找不到指定類別"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "無法取得類別"})
		}
		return
	}

	now := time.Now()
	transaction := models.Transaction{
		ID:         primitive.NewObjectID(),
		Type:       resolveCategoryType(category),
		Amount:     input.Amount,
		Category:   category.Name,
		CategoryID: category.ID,
		Date:       input.Date,
		Note:       input.Note,
		Owner:      currentUser,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if _, err := collection.InsertOne(ctx, transaction); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法寫入資料庫"})
		return
	}

	c.JSON(http.StatusOK, transaction)
}

// GetTransactions (date desc)
func GetTransactions(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})
	filter := bson.M{"owner": currentUser}

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取資料"})
		return
	}
	defer cursor.Close(ctx)

	var transactions []models.Transaction
	if err = cursor.All(ctx, &transactions); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "資料解析失敗"})
		return
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}
	c.JSON(http.StatusOK, transactions)
}

// UpdateTransaction (type derived from category)
func UpdateTransaction(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	objID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	var input transactionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	category, err := resolveCategory(ctx, currentUser, input.CategoryID, input.Category)
	if err != nil {
		switch err {
		case errCategoryRequired, errInvalidCategoryID:
			c.JSON(http.StatusBadRequest, gin.H{"error": "請提供有效的類別"})
		case errCategoryNotFound:
			c.JSON(http.StatusBadRequest, gin.H{"error": "找不到指定類別"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "無法取得類別"})
		}
		return
	}

	updatedAt := time.Now()
	update := bson.M{
		"$set": bson.M{
			"type":        resolveCategoryType(category),
			"amount":      input.Amount,
			"category":    category.Name,
			"category_id": category.ID,
			"date":        input.Date,
			"note":        input.Note,
			"owner":       currentUser,
			"updated_at":  updatedAt,
		},
	}

	filter := bson.M{"_id": objID, "owner": currentUser}
	result, err := collection.UpdateOne(ctx, filter, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失敗"})
		return
	}
	if result.MatchedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到該筆資料"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// DeleteTransaction
func DeleteTransaction(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	objID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "owner": currentUser}
	result, err := collection.DeleteOne(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刪除失敗"})
		return
	}
	if result.DeletedCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "找不到該筆資料"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "刪除成功"})
}
