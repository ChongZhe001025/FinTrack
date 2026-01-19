package controllers

import (
	"context"
	"net/http"
	"server/config"
	"server/models"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// WeeklyStat 回傳格式
type WeeklyStat struct {
	Day    string  `json:"day"`    // "Mon", "Tue"...
	Amount float64 `json:"amount"` // 總金額
	Order  int     `json:"-"`      // 排序用 (週一=1, 週日=7)
}

// GetWeeklyHabits 取得每週消費習慣 (支援 range 參數)
func GetWeeklyHabits(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. 讀取篩選參數 (預設 90 天)
	rangeType := c.DefaultQuery("range", "90days")

	now := time.Now()
	// 將時間設為當天的最後一刻，確保包含今天
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
		// 預設 90 天
		startDate = todayEnd.AddDate(0, -3, 0).Format("2006-01-02")
	}

	catCollection := config.GetCollection("categories")
	catCursor, err := catCollection.Find(ctx, bson.M{"owner": currentUser, "type": "expense"})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法取得分類資料"})
		return
	}
	defer catCursor.Close(ctx)

	var expenseCategories []models.Category
	if err = catCursor.All(ctx, &expenseCategories); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析分類資料失敗"})
		return
	}

	if len(expenseCategories) == 0 {
		c.JSON(http.StatusOK, []WeeklyStat{})
		return
	}

	expenseIDs := make([]primitive.ObjectID, 0, len(expenseCategories))
	for _, cat := range expenseCategories {
		expenseIDs = append(expenseIDs, cat.ID)
	}

	filter := bson.M{
		"owner":       currentUser,
		"category_id": bson.M{"$in": expenseIDs},
		"date":        bson.M{"$gte": startDate},
	}

	// 最佳化: 只撈取需要的欄位 (date, amount)
	opts := options.Find().
		SetProjection(bson.M{"date": 1, "amount": 1}).
		SetHint("idx_owner_cat_date")

	cursor, err := collection.Find(ctx, filter, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法取得資料"})
		return
	}
	defer cursor.Close(ctx)

	var transactions []models.Transaction
	if err = cursor.All(ctx, &transactions); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析失敗"})
		return
	}

	// 2. 統計週一到週日
	weekMap := map[time.Weekday]float64{
		time.Monday: 0, time.Tuesday: 0, time.Wednesday: 0,
		time.Thursday: 0, time.Friday: 0, time.Saturday: 0, time.Sunday: 0,
	}

	for _, t := range transactions {
		date, err := time.Parse("2006-01-02", t.Date)
		if err == nil {
			weekMap[date.Weekday()] += t.Amount
		}
	}

	// 3. 轉換與排序
	var results []WeeklyStat
	dayLabels := map[time.Weekday]string{
		time.Monday: "週一", time.Tuesday: "週二", time.Wednesday: "週三",
		time.Thursday: "週四", time.Friday: "週五", time.Saturday: "週六", time.Sunday: "週日",
	}
	orderMap := map[time.Weekday]int{
		time.Monday: 1, time.Tuesday: 2, time.Wednesday: 3,
		time.Thursday: 4, time.Friday: 5, time.Saturday: 6, time.Sunday: 7,
	}

	for k, v := range weekMap {
		results = append(results, WeeklyStat{
			Day:    dayLabels[k],
			Amount: v,
			Order:  orderMap[k],
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Order < results[j].Order
	})

	c.JSON(http.StatusOK, results)
}
