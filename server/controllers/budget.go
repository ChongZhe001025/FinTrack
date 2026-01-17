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

// SetBudget 新增或修改預算 (Upsert: 同月份同類別則更新，否則新增)
func SetBudget(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	var input models.Budget
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Owner = currentUser
	collection := config.GetCollection("budgets")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 搜尋條件：同一個月 + 同一個類別
	filter := bson.M{
		"category":   input.Category,
		"year_month": input.YearMonth,
		"owner":      currentUser,
	}
	update := bson.M{"$set": input}
	opts := options.Update().SetUpsert(true)

	_, err := collection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "設定預算失敗"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "預算已儲存"})
}

// DeleteBudget 刪除預算
func DeleteBudget(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	collection := config.GetCollection("budgets")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"_id": objID, "owner": currentUser}
	_, err = collection.DeleteOne(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "刪除失敗"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "刪除成功"})
}

// GetBudgetStatus 取得指定月份的預算執行狀況
func GetBudgetStatus(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	// 讀取月份參數，預設為當月 (格式 2026-01)
	queryMonth := c.DefaultQuery("month", time.Now().Format("2006-01"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. 取得該月份設定的所有預算
	budgetColl := config.GetCollection("budgets")
	cursor, err := budgetColl.Find(ctx, bson.M{"year_month": queryMonth, "owner": currentUser})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取預算"})
		return
	}
	var budgets []models.Budget
	cursor.All(ctx, &budgets)

	// 若該月無預算，回傳空陣列
	if len(budgets) == 0 {
		c.JSON(http.StatusOK, []gin.H{})
		return
	}

	// 2. 計算該月份的實際支出
	// 計算該月的第一天與最後一天字串，用於查詢 Transaction
	// e.g., "2026-01" -> start: "2026-01-01", nextMonth: "2026-02-01"
	parseTime, _ := time.Parse("2006-01", queryMonth)
	startStr := parseTime.Format("2006-01-02")
	endStr := parseTime.AddDate(0, 1, 0).Format("2006-01-02")

	transColl := config.GetCollection("transactions")

	// 準備回傳資料
	var statusList []gin.H

	for _, b := range budgets {
		// 聚合查詢：只查該類別 + 該時間範圍
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.D{
				{Key: "owner", Value: currentUser},
				{Key: "category", Value: b.Category},
				{Key: "date", Value: bson.D{
					{Key: "$gte", Value: startStr},
					{Key: "$lt", Value: endStr},
				}},
			}}},
			{{Key: "$lookup", Value: bson.D{
				{Key: "from", Value: "categories"},
				{Key: "let", Value: bson.D{
					{Key: "catId", Value: "$category_id"},
					{Key: "catName", Value: "$category"},
					{Key: "owner", Value: "$owner"},
				}},
				{Key: "pipeline", Value: bson.A{
					bson.M{"$match": bson.M{"$expr": bson.M{"$and": bson.A{
						bson.M{"$eq": bson.A{"$owner", "$$owner"}},
						bson.M{"$or": bson.A{
							bson.M{"$eq": bson.A{"$_id", "$$catId"}},
							bson.M{"$eq": bson.A{"$name", "$$catName"}},
						}},
					}}}},
					bson.M{"$project": bson.M{"_id": 0, "type": 1}},
					bson.M{"$limit": 1},
				}},
				{Key: "as", Value: "categoryDoc"},
			}}},
			{{Key: "$unwind", Value: bson.D{
				{Key: "path", Value: "$categoryDoc"},
				{Key: "preserveNullAndEmptyArrays", Value: false},
			}}},
			{{Key: "$match", Value: bson.D{
				{Key: "categoryDoc.type", Value: "expense"},
			}}},
			{{Key: "$group", Value: bson.D{
				{Key: "_id", Value: nil},
				{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
			}}},
		}

		cursor, _ := transColl.Aggregate(ctx, pipeline)
		var aggResults []struct {
			Total float64 `bson:"total"`
		}
		spent := 0.0
		if err = cursor.All(ctx, &aggResults); err == nil && len(aggResults) > 0 {
			spent = aggResults[0].Total
		}

		percentage := 0.0
		if b.Amount > 0 {
			percentage = (spent / b.Amount) * 100
		}

		statusList = append(statusList, gin.H{
			"id":         b.ID.Hex(),
			"category":   b.Category,
			"limit":      b.Amount,
			"spent":      spent,
			"percentage": percentage,
			"year_month": b.YearMonth,
		})
	}

	c.JSON(http.StatusOK, statusList)
}
