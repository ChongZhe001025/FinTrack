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
	currentUser := c.MustGet("currentUser").(string)
	var input models.Transaction

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Owner = currentUser
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
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 修改重點：加入排序選項，依照 "date" 欄位倒序 (-1) 排列
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

	// 如果沒有資料，回傳空陣列而不是 null
	if transactions == nil {
		transactions = []models.Transaction{}
	}

	c.JSON(http.StatusOK, transactions)
}

// GetDashboardStats godoc
// @Summary      取得統計數據
// @Description  計算指定月份的總收入、總支出、結餘與上月環比
// @Tags         Stats
// @Produce      json
// @Param        month query string false "月份 (YYYY-MM)"
// @Success      200  {object}  map[string]interface{}
// @Router       /stats [get]
func GetDashboardStats(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	monthParam := c.Query("month")
	now := time.Now()
	location := now.Location()
	var targetMonth time.Time

	if monthParam == "" {
		targetMonth = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, location)
	} else {
		parsedMonth, err := time.ParseInLocation("2006-01", monthParam, location)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month 格式錯誤，請使用 YYYY-MM"})
			return
		}
		targetMonth = time.Date(parsedMonth.Year(), parsedMonth.Month(), 1, 0, 0, 0, 0, location)
	}

	thisMonthStart := targetMonth
	thisMonthEnd := thisMonthStart.AddDate(0, 1, 0)
	lastMonthStart := thisMonthStart.AddDate(0, -1, 0)
	lastMonthEnd := thisMonthStart

	getTotals := func(start, end time.Time) (map[string]float64, error) {
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.D{
				{Key: "owner", Value: currentUser},
				{Key: "date", Value: bson.D{
					{Key: "$gte", Value: start.Format("2006-01-02")},
					{Key: "$lt", Value: end.Format("2006-01-02")},
				}},
			}}},
			{{Key: "$group", Value: bson.D{
				{Key: "_id", Value: "$type"},                                   // 依照 type 分組 (income/expense)
				{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}}, // 加總 amount
			}}},
		}

		cursor, err := collection.Aggregate(ctx, pipeline)
		if err != nil {
			return nil, err
		}
		defer cursor.Close(ctx)

		var results []bson.M
		if err = cursor.All(ctx, &results); err != nil {
			return nil, err
		}

		totals := map[string]float64{
			"income":  0,
			"expense": 0,
		}

		for _, result := range results {
			typeStr := result["_id"].(string)
			total := result["total"].(float64) // 注意：MongoDB 數字型別轉換
			if typeStr == "income" {
				totals["income"] = total
			} else if typeStr == "expense" {
				totals["expense"] = total
			}
		}

		return totals, nil
	}

	thisTotals, err := getTotals(thisMonthStart, thisMonthEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "統計計算失敗"})
		return
	}

	lastTotals, err := getTotals(lastMonthStart, lastMonthEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "計算上月資料失敗"})
		return
	}

	calcTrend := func(current, previous float64) float64 {
		if previous == 0 {
			return 0
		}
		return (current - previous) / previous * 100
	}

	totalIncome := thisTotals["income"]
	totalExpense := thisTotals["expense"]
	balance := totalIncome - totalExpense
	lastBalance := lastTotals["income"] - lastTotals["expense"]

	stats := gin.H{
		"total_income":  totalIncome,
		"total_expense": totalExpense,
		"balance":       balance,
		"income_trend":  calcTrend(totalIncome, lastTotals["income"]),
		"expense_trend": calcTrend(totalExpense, lastTotals["expense"]),
		"balance_trend": calcTrend(balance, lastBalance),
		"month":         thisMonthStart.Format("2006-01"),
	}

	c.JSON(http.StatusOK, stats)
}

// GetCategoryStats godoc
// @Summary      取得類別統計
// @Description  計算指定月份各分類的支出總額 (用於圓餅圖)
// @Tags         Stats
// @Produce      json
// @Param        month query string false "月份 (YYYY-MM)"
// @Success      200  {array}  map[string]interface{}
// @Router       /stats/category [get]
func GetCategoryStats(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	monthParam := c.Query("month")
	now := time.Now()
	location := now.Location()
	var targetMonth time.Time

	if monthParam == "" {
		targetMonth = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, location)
	} else {
		parsedMonth, err := time.ParseInLocation("2006-01", monthParam, location)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month 格式錯誤，請使用 YYYY-MM"})
			return
		}
		targetMonth = time.Date(parsedMonth.Year(), parsedMonth.Month(), 1, 0, 0, 0, 0, location)
	}

	monthStart := targetMonth
	monthEnd := monthStart.AddDate(0, 1, 0)

	// Aggregation Pipeline:
	// 1. $match: 只篩選 "expense" (支出)
	// 2. $group: 依照 "category" 分組，並加總 "amount"
	// 3. $sort: 依照總金額由大到小排序
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{
			{Key: "owner", Value: currentUser},
			{Key: "type", Value: "expense"},
			{Key: "date", Value: bson.D{
				{Key: "$gte", Value: monthStart.Format("2006-01-02")},
				{Key: "$lt", Value: monthEnd.Format("2006-01-02")},
			}},
		}}},
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
	currentUser := c.MustGet("currentUser").(string)
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
			"owner":      currentUser,
			"updated_at": input.UpdatedAt,
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

// DeleteTransaction 刪除交易
func DeleteTransaction(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
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

// GetMonthlyComparison godoc
// @Summary      取得月度對比
// @Description  比較指定月份與上個月的各類別支出
// @Tags         Stats
// @Produce      json
// @Param        month query string false "月份 (YYYY-MM)"
// @Success      200  {array}  map[string]interface{}
// @Router       /stats/comparison [get]
func GetMonthlyComparison(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. 計算時間範圍
	monthParam := c.Query("month")
	now := time.Now()
	location := now.Location()
	var targetMonth time.Time

	if monthParam == "" {
		targetMonth = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, location)
	} else {
		parsedMonth, err := time.ParseInLocation("2006-01", monthParam, location)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month 格式錯誤，請使用 YYYY-MM"})
			return
		}
		targetMonth = time.Date(parsedMonth.Year(), parsedMonth.Month(), 1, 0, 0, 0, 0, location)
	}

	// 本月起訖
	thisMonthStart := targetMonth
	thisMonthEnd := thisMonthStart.AddDate(0, 1, 0) // 下個月1號即為本月結束點

	// 上月起訖
	lastMonthStart := thisMonthStart.AddDate(0, -1, 0)
	lastMonthEnd := thisMonthStart

	// 2. 定義 Aggregation 函式 (重用邏輯)
	getStats := func(start, end time.Time) (map[string]float64, error) {
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.D{
				{Key: "owner", Value: currentUser},
				{Key: "type", Value: "expense"}, // 只看支出
				{Key: "date", Value: bson.D{
					{Key: "$gte", Value: start.Format("2006-01-02")},
					{Key: "$lt", Value: end.Format("2006-01-02")},
				}},
			}}},
			{{Key: "$group", Value: bson.D{
				{Key: "_id", Value: "$category"},
				{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
			}}},
		}

		cursor, err := collection.Aggregate(ctx, pipeline)
		if err != nil {
			return nil, err
		}
		defer cursor.Close(ctx)

		var results []bson.M
		if err = cursor.All(ctx, &results); err != nil {
			return nil, err
		}

		stats := make(map[string]float64)
		for _, r := range results {
			stats[r["_id"].(string)] = r["total"].(float64)
		}
		return stats, nil
	}

	// 3. 分別撈取資料
	thisMonthStats, err := getStats(thisMonthStart, thisMonthEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "計算本月資料失敗"})
		return
	}

	lastMonthStats, err := getStats(lastMonthStart, lastMonthEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "計算上月資料失敗"})
		return
	}

	// 4. 合併資料 (Merge)
	// 找出所有出現過的類別
	categories := make(map[string]bool)
	for k := range thisMonthStats {
		categories[k] = true
	}
	for k := range lastMonthStats {
		categories[k] = true
	}

	var response []gin.H
	for cat := range categories {
		response = append(response, gin.H{
			"category": cat,
			"current":  thisMonthStats[cat], // 若無 key 會回傳 0 (float64 預設值)
			"previous": lastMonthStats[cat],
		})
	}

	c.JSON(http.StatusOK, response)
}
