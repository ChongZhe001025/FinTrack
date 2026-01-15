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
	"go.mongodb.org/mongo-driver/mongo/options" // 新增: 用於設定查詢選項 (排序)
)

// CreateTransaction godoc
// @Summary      新增記帳
// @Description  建立一筆新的收入或支出紀錄
// @Tags         Transactions
// @Accept       json
// @Produce      json
// @Param        transaction body models.Transaction true "記帳資料"
// @Success      200  {object}  models.Transaction
// @Router       /transactions [post]
func CreateTransaction(c *gin.Context) {
	var input models.Transaction

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.ID = primitive.NewObjectID()
	input.CreatedAt = time.Now()
	input.UpdatedAt = time.Now()

	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法寫入資料庫"})
		return
	}

	c.JSON(http.StatusOK, input)
}

// GetTransactions godoc
// @Summary      取得列表
// @Description  取得所有記帳紀錄 (依日期由新到舊排序)
// @Tags         Transactions
// @Produce      json
// @Success      200  {array}  models.Transaction
// @Router       /transactions [get]
func GetTransactions(c *gin.Context) {
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 修改重點：加入排序選項，依照 "date" 欄位倒序 (-1) 排列
	opts := options.Find().SetSort(bson.D{{Key: "date", Value: -1}})

	cursor, err := collection.Find(ctx, bson.M{}, opts)
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

	// 如果沒有資料，回傳空陣列而不是 null
	if transactions == nil {
		transactions = []models.Transaction{}
	}

	c.JSON(http.StatusOK, transactions)
}

// GetDashboardStats godoc
// @Summary      取得統計數據
// @Description  計算總收入、總支出與結餘
// @Tags         Stats
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Router       /stats [get]
func GetDashboardStats(c *gin.Context) {
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 使用 MongoDB Aggregation Pipeline 計算總和
	// 類似 SQL: SELECT type, SUM(amount) FROM transactions GROUP BY type
	pipeline := mongo.Pipeline{
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$type"},                                   // 依照 type 分組 (income/expense)
			{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}}, // 加總 amount
		}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "統計計算失敗"})
		return
	}
	defer cursor.Close(ctx)

	var results []bson.M
	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析統計失敗"})
		return
	}

	// 整理數據格式
	stats := map[string]float64{
		"total_income":  0,
		"total_expense": 0,
		"balance":       0,
	}

	for _, result := range results {
		// result["_id"] 是 "income" 或 "expense"
		// result["total"] 是總金額
		typeStr := result["_id"].(string)
		total := result["total"].(float64) // 注意：MongoDB 數字型別轉換

		if typeStr == "income" {
			stats["total_income"] = total
		} else if typeStr == "expense" {
			stats["total_expense"] = total
		}
	}

	// 計算結餘
	stats["balance"] = stats["total_income"] - stats["total_expense"]

	c.JSON(http.StatusOK, stats)
}

// GetCategoryStats godoc
// @Summary      取得類別統計
// @Description  計算各分類的支出總額 (用於圓餅圖)
// @Tags         Stats
// @Produce      json
// @Success      200  {array}  map[string]interface{}
// @Router       /stats/category [get]
func GetCategoryStats(c *gin.Context) {
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Aggregation Pipeline:
	// 1. $match: 只篩選 "expense" (支出)
	// 2. $group: 依照 "category" 分組，並加總 "amount"
	// 3. $sort: 依照總金額由大到小排序
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{{Key: "type", Value: "expense"}}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$category"},
			{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "total", Value: -1}}}}, // 金額大的排前面
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "統計計算失敗"})
		return
	}
	defer cursor.Close(ctx)

	var results []bson.M
	if err = cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析統計失敗"})
		return
	}

	// 整理回傳格式
	// 目標格式: [{"category": "Food", "amount": 500}, ...]
	var stats []gin.H
	for _, result := range results {
		stats = append(stats, gin.H{
			"category": result["_id"],
			"amount":   result["total"],
		})
	}

	c.JSON(http.StatusOK, stats)
}

// ... (保留原本的 create 和 get)

// UpdateTransaction 修改交易
func UpdateTransaction(c *gin.Context) {
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	var input models.Transaction
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 更新時間
	input.UpdatedAt = time.Now()

	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"type":       input.Type,
			"amount":     input.Amount,
			"category":   input.Category,
			"date":       input.Date,
			"note":       input.Note,
			"updated_at": input.UpdatedAt,
		},
	}

	result, err := collection.UpdateOne(ctx, bson.M{"_id": objID}, update)
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

// DeleteTransaction 刪除交易
func DeleteTransaction(c *gin.Context) {
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := collection.DeleteOne(ctx, bson.M{"_id": objID})
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
