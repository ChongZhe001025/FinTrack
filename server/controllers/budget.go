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

	// 2. 取得有預算的類別名稱列表
	categoryNames := make([]string, 0, len(budgets))
	for _, b := range budgets {
		categoryNames = append(categoryNames, b.Category)
	}

	// 3. 取得類別 ID 映射 (Name -> ID)
	catColl := config.GetCollection("categories")
	catCursor, err := catColl.Find(ctx, bson.M{"owner": currentUser, "name": bson.M{"$in": categoryNames}})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取分類資料"})
		return
	}
	defer catCursor.Close(ctx)

	var categories []models.Category
	if err = catCursor.All(ctx, &categories); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析分類資料失敗"})
		return
	}

	catIDMap := make(map[string]primitive.ObjectID, len(categories))
	catTypeMap := make(map[string]string, len(categories))
	categoryIDs := make([]primitive.ObjectID, 0, len(categories))

	for _, cat := range categories {
		catIDMap[cat.Name] = cat.ID
		catTypeMap[cat.Name] = cat.Type
		categoryIDs = append(categoryIDs, cat.ID)
	}

	// 4. 一次性聚合查詢：計算所有相關類別的本月支出總和
	parseTime, _ := time.Parse("2006-01", queryMonth)
	startStr := parseTime.Format("2006-01-02")
	endStr := parseTime.AddDate(0, 1, 0).Format("2006-01-02")

	transColl := config.GetCollection("transactions")
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{
			{Key: "owner", Value: currentUser},
			{Key: "category_id", Value: bson.M{"$in": categoryIDs}},
			{Key: "date", Value: bson.D{
				{Key: "$gte", Value: startStr},
				{Key: "$lt", Value: endStr},
			}},
		}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$category_id"},
			{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
		}}},
	}

	// 使用索引優化查詢
	opts := options.Aggregate().SetHint("idx_owner_cat_date")

	cursorAgg, err := transColl.Aggregate(ctx, pipeline, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "統計預算失敗"})
		return
	}
	var aggResults []struct {
		CategoryID primitive.ObjectID `bson:"_id"`
		Total      float64            `bson:"total"`
	}
	if err = cursorAgg.All(ctx, &aggResults); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析統計失敗"})
		return
	}

	// 轉為 Map 方便查找
	expenseMap := make(map[primitive.ObjectID]float64)
	for _, res := range aggResults {
		expenseMap[res.CategoryID] = res.Total
	}

	// 5. 組裝回傳資料
	var statusList []gin.H

	for _, b := range budgets {
		catType := catTypeMap[b.Category]

		// 收入類別不計算預算消耗
		if catType == "income" {
			statusList = append(statusList, gin.H{
				"id":         b.ID.Hex(),
				"category":   b.Category,
				"limit":      b.Amount,
				"spent":      0.0,
				"percentage": 0.0,
				"year_month": b.YearMonth,
			})
			continue
		}

		catID, ok := catIDMap[b.Category]
		spent := 0.0
		if ok {
			spent = expenseMap[catID]
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
