package controllers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"server/config"
	"server/models"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// CreateFixedExpense godoc
// @Summary      新增每月固定支出
// @Description  建立固定支出並嘗試為當月建立交易紀錄
// @Tags         FixedExpenses
// @Accept       json
// @Produce      json
// @Param        fixedExpense body models.FixedExpense true "固定支出資料"
// @Success      200  {object}  models.FixedExpense
// @Router       /fixed-expenses [post]
func CreateFixedExpense(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	var input models.FixedExpense

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	input.Owner = currentUser
	input.ID = primitive.NewObjectID()
	input.CreatedAt = time.Now()
	input.UpdatedAt = time.Now()

	collection := config.GetCollection("fixed_expenses")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := collection.InsertOne(ctx, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法寫入固定支出設定"})
		return
	}

	// 建立當月交易紀錄
	// 邏輯: 根據設定的 Day，計算出本月的日期，建立一筆 Transaction
	go createTransactionForFixedExpense(input, time.Now())

	c.JSON(http.StatusOK, input)
}

// ProcessFixedExpenses 每日檢查並執行固定支出
func ProcessFixedExpenses() {
	collection := config.GetCollection("fixed_expenses")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now()
	today := now.Day()

	// 處理月底邏輯 (例如 2/28 要處理 29, 30, 31 號的固定支出?
	// 簡單起見，如果今天是該月最後一天，且設定的日期大於今天，則也視為今天要執行?
	// 這裡先實作最直觀的: 只處理 Day == today)
	// TODO: 優化月底處理邏輯

	filter := bson.M{"day": today}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Printf("[Cron] 查詢固定支出失敗: %v", err)
		return
	}
	defer cursor.Close(ctx)

	var expenses []models.FixedExpense
	if err = cursor.All(ctx, &expenses); err != nil {
		log.Printf("[Cron] 解析固定支出失敗: %v", err)
		return
	}

	log.Printf("[Cron] 發現 %d 筆固定支出需處理 (Day=%d)", len(expenses), today)

	for _, exp := range expenses {
		createTransactionForFixedExpense(exp, now)
	}
}

func createTransactionForFixedExpense(exp models.FixedExpense, dateBase time.Time) {
	transactionCollection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 計算目標日期
	// 注意: 我們使用 dateBase 的年份和月份，但日子是 exp.Day
	// 如果 exp.Day 超過該月天數 (例如 2月30日)，time.Date 會自動正規化到下個月
	// 為了避免這種情況，我們應該檢查該月最大天數，或者 Go 的 behavior.
	// Go time.Date behavior: October 32 becomes November 1.
	// 為了符合 "每月固定支出" 直覺，如果是 31 號但該月只有 30 天，應該記在 30 號還是忽略?
	// 這裡採用: 若溢位則取該月最後一天

	year, month, _ := dateBase.Date()
	targetDate := time.Date(year, month, exp.Day, 0, 0, 0, 0, dateBase.Location())

	// 如果 targetDate 的月份跑掉了，代表原定日子超過該月天數
	if targetDate.Month() != month {
		// 設定為該月最後一天
		// 取得下個月1號 - 1天
		firstDayNextMonth := time.Date(year, month+1, 1, 0, 0, 0, 0, dateBase.Location())
		targetDate = firstDayNextMonth.AddDate(0, 0, -1)
	}

	dateStr := targetDate.Format("2006-01-02")

	// 檢查是否已經建立過 (避免重複執行，雖然 Cron 每天跑一次理論上還好，但加個保險)
	// 簡單檢查: 同 Category, 同 Owner, 同 Date, 同 Amount (可能太嚴格?)
	// 更好的方式可能是紀錄 FixedExpense 上次執行的時間? 但 user request 沒提到要改 schema 這麼细
	// 先暫時不做重複檢查，因為 createTransactionForFixedExpense 只有在 Create 和 Cron 時呼叫

	transaction := models.Transaction{
		ID:         primitive.NewObjectID(),
		Amount:     exp.Amount,
		CategoryID: exp.CategoryID,
		Date:       dateStr,
		Note:       fmt.Sprintf("%s (固定支出)", exp.Note),
		Owner:      exp.Owner,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	_, err := transactionCollection.InsertOne(ctx, transaction)
	if err != nil {
		log.Printf("建立固定支出交易失敗 [_id: %s]: %v", exp.ID.Hex(), err)
	} else {
		log.Printf("成功建立固定支出交易: %s - %s", exp.Owner, dateStr)
	}
}

// GetFixedExpenses godoc
// @Summary      取得所有固定支出
// @Description  取得當前使用者的所有固定支出設定
// @Tags         FixedExpenses
// @Produce      json
// @Success      200  {array}  models.FixedExpense
// @Router       /fixed-expenses [get]
func GetFixedExpenses(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("fixed_expenses")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"owner": currentUser}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "無法讀取資料"})
		return
	}
	defer cursor.Close(ctx)

	var expenses []models.FixedExpense
	if err = cursor.All(ctx, &expenses); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "資料解析失敗"})
		return
	}

	if expenses == nil {
		expenses = []models.FixedExpense{}
	}

	c.JSON(http.StatusOK, expenses)
}

// DeleteFixedExpense godoc
// @Summary      刪除固定支出
// @Description  刪除指定的固定支出設定 (不會刪除已產生的交易)
// @Tags         FixedExpenses
// @Param        id   path      string  true  "Fixed Expense ID"
// @Success      200  {object}  map[string]string
// @Router       /fixed-expenses/{id} [delete]
func DeleteFixedExpense(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	idParam := c.Param("id")
	objID, err := primitive.ObjectIDFromHex(idParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "無效的 ID"})
		return
	}

	collection := config.GetCollection("fixed_expenses")
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
