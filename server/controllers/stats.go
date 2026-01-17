// controllers/stats.go
package controllers

import (
	"context"
	"net/http"
	"server/config"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// GetDashboardStats: totals by categoryDoc.type (income/expense)
func GetDashboardStats(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	monthParam := c.Query("month")
	now := time.Now()
	loc := now.Location()

	var targetMonth time.Time
	if monthParam == "" {
		targetMonth = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	} else {
		parsed, err := time.ParseInLocation("2006-01", monthParam, loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month 格式錯誤，請使用 YYYY-MM"})
			return
		}
		targetMonth = time.Date(parsed.Year(), parsed.Month(), 1, 0, 0, 0, 0, loc)
	}

	thisStart := targetMonth
	thisEnd := thisStart.AddDate(0, 1, 0)
	lastStart := thisStart.AddDate(0, -1, 0)
	lastEnd := thisStart

	getTotals := func(start, end time.Time) (map[string]float64, error) {
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.D{
				{Key: "owner", Value: currentUser},
				{Key: "date", Value: bson.D{
					{Key: "$gte", Value: start.Format("2006-01-02")},
					{Key: "$lt", Value: end.Format("2006-01-02")},
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
					bson.M{"$project": bson.M{"_id": 1, "type": 1}},
					bson.M{"$limit": 1},
				}},
				{Key: "as", Value: "categoryDoc"},
			}}},
			{{Key: "$unwind", Value: bson.D{
				{Key: "path", Value: "$categoryDoc"},
				{Key: "preserveNullAndEmptyArrays", Value: false},
			}}},
			{{Key: "$match", Value: bson.D{
				{Key: "categoryDoc.type", Value: bson.M{"$in": bson.A{"income", "expense"}}},
			}}},
			{{Key: "$group", Value: bson.D{
				{Key: "_id", Value: "$categoryDoc.type"},
				{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
			}}},
		}

		cursor, err := collection.Aggregate(ctx, pipeline)
		if err != nil {
			return nil, err
		}
		defer cursor.Close(ctx)

		var results []bson.M
		if err := cursor.All(ctx, &results); err != nil {
			return nil, err
		}

		totals := map[string]float64{"income": 0, "expense": 0}
		for _, r := range results {
			typeStr, _ := r["_id"].(string)
			total := toFloat64(r["total"])
			if typeStr == "income" || typeStr == "expense" {
				totals[typeStr] = total
			}
		}
		return totals, nil
	}

	thisTotals, err := getTotals(thisStart, thisEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "統計計算失敗"})
		return
	}
	lastTotals, err := getTotals(lastStart, lastEnd)
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

	c.JSON(http.StatusOK, gin.H{
		"total_income":  totalIncome,
		"total_expense": totalExpense,
		"balance":       balance,
		"income_trend":  calcTrend(totalIncome, lastTotals["income"]),
		"expense_trend": calcTrend(totalExpense, lastTotals["expense"]),
		"balance_trend": calcTrend(balance, lastBalance),
		"month":         thisStart.Format("2006-01"),
	})
}

// GetCategoryStats: expense only, grouped by categoryDoc.name
func GetCategoryStats(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	monthParam := c.Query("month")
	now := time.Now()
	loc := now.Location()

	var targetMonth time.Time
	if monthParam == "" {
		targetMonth = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	} else {
		parsed, err := time.ParseInLocation("2006-01", monthParam, loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month 格式錯誤，請使用 YYYY-MM"})
			return
		}
		targetMonth = time.Date(parsed.Year(), parsed.Month(), 1, 0, 0, 0, 0, loc)
	}

	start := targetMonth
	end := start.AddDate(0, 1, 0)

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{
			{Key: "owner", Value: currentUser},
			{Key: "date", Value: bson.D{
				{Key: "$gte", Value: start.Format("2006-01-02")},
				{Key: "$lt", Value: end.Format("2006-01-02")},
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
				bson.M{"$project": bson.M{"_id": 1, "name": 1, "type": 1}},
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
			{Key: "_id", Value: "$categoryDoc.name"},
			{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
		}}},
		{{Key: "$sort", Value: bson.D{{Key: "total", Value: -1}}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "統計計算失敗"})
		return
	}
	defer cursor.Close(ctx)

	var results []bson.M
	if err := cursor.All(ctx, &results); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析統計失敗"})
		return
	}

	stats := make([]gin.H, 0, len(results))
	for _, r := range results {
		stats = append(stats, gin.H{
			"category": r["_id"],
			"amount":   toFloat64(r["total"]),
		})
	}

	c.JSON(http.StatusOK, stats)
}

// GetMonthlyComparison: expense only, compare current vs previous month
func GetMonthlyComparison(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	monthParam := c.Query("month")
	now := time.Now()
	loc := now.Location()

	var targetMonth time.Time
	if monthParam == "" {
		targetMonth = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	} else {
		parsed, err := time.ParseInLocation("2006-01", monthParam, loc)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month 格式錯誤，請使用 YYYY-MM"})
			return
		}
		targetMonth = time.Date(parsed.Year(), parsed.Month(), 1, 0, 0, 0, 0, loc)
	}

	thisStart := targetMonth
	thisEnd := thisStart.AddDate(0, 1, 0)
	lastStart := thisStart.AddDate(0, -1, 0)
	lastEnd := thisStart

	getStats := func(start, end time.Time) (map[string]float64, error) {
		pipeline := mongo.Pipeline{
			{{Key: "$match", Value: bson.D{
				{Key: "owner", Value: currentUser},
				{Key: "date", Value: bson.D{
					{Key: "$gte", Value: start.Format("2006-01-02")},
					{Key: "$lt", Value: end.Format("2006-01-02")},
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
					bson.M{"$project": bson.M{"_id": 1, "name": 1, "type": 1}},
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
				{Key: "_id", Value: "$categoryDoc.name"},
				{Key: "total", Value: bson.D{{Key: "$sum", Value: "$amount"}}},
			}}},
		}

		cursor, err := collection.Aggregate(ctx, pipeline)
		if err != nil {
			return nil, err
		}
		defer cursor.Close(ctx)

		var results []bson.M
		if err := cursor.All(ctx, &results); err != nil {
			return nil, err
		}

		out := make(map[string]float64, len(results))
		for _, r := range results {
			out[toString(r["_id"])] = toFloat64(r["total"])
		}
		return out, nil
	}

	thisStats, err := getStats(thisStart, thisEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "計算本月資料失敗"})
		return
	}
	lastStats, err := getStats(lastStart, lastEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "計算上月資料失敗"})
		return
	}

	keys := make(map[string]bool)
	for k := range thisStats {
		keys[k] = true
	}
	for k := range lastStats {
		keys[k] = true
	}

	response := make([]gin.H, 0, len(keys))
	for cat := range keys {
		response = append(response, gin.H{
			"category": cat,
			"current":  thisStats[cat],
			"previous": lastStats[cat],
		})
	}

	c.JSON(http.StatusOK, response)
}

// WeeklyStat 回傳格式
type WeeklyStat struct {
	Day    string  `json:"day"`
	Amount float64 `json:"amount"`
	Order  int     `json:"-"`
}

// GetWeeklyHabits: expense only, aggregated by weekday (client wants Mon..Sun buckets)
func GetWeeklyHabits(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rangeType := c.DefaultQuery("range", "90days")
	now := time.Now()
	todayEnd := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 0, now.Location())

	var startDate string
	switch rangeType {
	case "7days":
		startDate = todayEnd.AddDate(0, 0, -7).Format("2006-01-02")
	case "30days":
		startDate = todayEnd.AddDate(0, 0, -30).Format("2006-01-02")
	case "90days":
		startDate = todayEnd.AddDate(0, -3, 0).Format("2006-01-02")
	case "180days":
		startDate = todayEnd.AddDate(0, -6, 0).Format("2006-01-02")
	case "365days":
		startDate = todayEnd.AddDate(-1, 0, 0).Format("2006-01-02")
	default:
		startDate = todayEnd.AddDate(0, -3, 0).Format("2006-01-02")
	}

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{
			{Key: "owner", Value: currentUser},
			{Key: "date", Value: bson.D{{Key: "$gte", Value: startDate}}},
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
		{{Key: "$project", Value: bson.D{
			{Key: "amount", Value: 1},
			{Key: "date", Value: 1},
		}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法取得資料"})
		return
	}
	defer cursor.Close(ctx)

	var txs []struct {
		Amount float64 `bson:"amount"`
		Date   string  `bson:"date"`
	}
	if err := cursor.All(ctx, &txs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析失敗"})
		return
	}

	weekMap := map[time.Weekday]float64{
		time.Monday: 0, time.Tuesday: 0, time.Wednesday: 0,
		time.Thursday: 0, time.Friday: 0, time.Saturday: 0, time.Sunday: 0,
	}

	for _, t := range txs {
		d, err := time.Parse("2006-01-02", t.Date)
		if err == nil {
			weekMap[d.Weekday()] += t.Amount
		}
	}

	dayLabels := map[time.Weekday]string{
		time.Monday: "週一", time.Tuesday: "週二", time.Wednesday: "週三",
		time.Thursday: "週四", time.Friday: "週五", time.Saturday: "週六", time.Sunday: "週日",
	}
	orderMap := map[time.Weekday]int{
		time.Monday: 1, time.Tuesday: 2, time.Wednesday: 3,
		time.Thursday: 4, time.Friday: 5, time.Saturday: 6, time.Sunday: 7,
	}

	results := make([]WeeklyStat, 0, 7)
	for k, v := range weekMap {
		results = append(results, WeeklyStat{Day: dayLabels[k], Amount: v, Order: orderMap[k]})
	}

	sort.Slice(results, func(i, j int) bool { return results[i].Order < results[j].Order })
	c.JSON(http.StatusOK, results)
}
