package controllers

import (
	"context"
	"net/http"
	"server/config"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type YearlyReportResponse struct {
	Year       int                `json:"year"`
	Summary    YearlySummary      `json:"summary"`
	Monthly    []YearlyMonthly    `json:"monthly"`
	ByCategory []YearlyByCategory `json:"byCategory"`
}

type YearlySummary struct {
	TotalExpense      float64     `json:"totalExpense"`
	TotalIncome       float64     `json:"totalIncome"`
	Net               float64     `json:"net"`
	AvgMonthlyExpense float64     `json:"avgMonthlyExpense"`
	MaxExpenseMonth   MonthAmount `json:"maxExpenseMonth"`
	MinExpenseMonth   MonthAmount `json:"minExpenseMonth"`
}

type MonthAmount struct {
	Month  int     `json:"month"`
	Amount float64 `json:"amount"`
}

type YearlyMonthly struct {
	Month   int     `json:"month"`
	Expense float64 `json:"expense"`
	Income  float64 `json:"income"`
	Net     float64 `json:"net"`
}

type YearlyByCategory struct {
	CategoryID   string  `json:"categoryId"`
	CategoryName string  `json:"categoryName"`
	Total        float64 `json:"total"`
	Percent      float64 `json:"percent"`
	Count        int64   `json:"count"`
	AvgMonthly   float64 `json:"avgMonthly"`
}

// GetYearlyReport godoc
// @Summary      Yearly report
// @Description  Returns yearly summary, monthly totals, and category totals.
// @Tags         Reports
// @Produce      json
// @Param        year query int false "Year (YYYY)"
// @Success      200  {object}  YearlyReportResponse
// @Router       /reports/yearly [get]
func GetYearlyReport(c *gin.Context) {
	currentUser := c.MustGet("currentUser").(string)
	collection := config.GetCollection("transactions")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	yearParam := c.Query("year")
	year := time.Now().Year()
	if yearParam != "" {
		parsedYear, err := strconv.Atoi(yearParam)
		if err != nil || parsedYear <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid year, use YYYY"})
			return
		}
		year = parsedYear
	}

	// ✅ 建議固定 +08:00，避免 docker/server 時區不是台灣導致跨日/月錯位
	timezone := "+08:00"
	start := time.Date(year, 1, 1, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*3600))
	end := start.AddDate(1, 0, 0)

	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.M{"owner": currentUser}}},
		{{Key: "$lookup", Value: bson.M{
			"from": "categories",
			"let": bson.M{
				"catId":   "$category_id",
				"catName": "$category",
				"owner":   "$owner",
			},
			"pipeline": bson.A{
				bson.M{"$match": bson.M{"$expr": bson.M{"$and": bson.A{
					bson.M{"$eq": bson.A{"$owner", "$$owner"}},
					bson.M{"$or": bson.A{
						bson.M{"$eq": bson.A{"$_id", "$$catId"}},
						bson.M{"$eq": bson.A{"$name", "$$catName"}},
					}},
				}}}},
				bson.M{"$project": bson.M{"_id": 1, "name": 1, "type": 1}},
				bson.M{"$limit": 1},
			},
			"as": "categoryDoc",
		}}},
		{{Key: "$unwind", Value: bson.M{"path": "$categoryDoc", "preserveNullAndEmptyArrays": false}}},
		{{Key: "$match", Value: bson.M{"categoryDoc.type": bson.M{"$in": bson.A{"expense", "income"}}}}},

		// ✅ 你的 schema 是 date: "YYYY-MM-DD"，直接 parse
		{{Key: "$addFields", Value: bson.M{
			"dateParsed": bson.M{"$dateFromString": bson.M{
				"dateString": "$date",
				"format":     "%Y-%m-%d",
				"timezone":   timezone,
			}},
		}}},
		{{Key: "$match", Value: bson.M{"dateParsed": bson.M{"$gte": start, "$lt": end}}}},

		{{Key: "$facet", Value: bson.M{
			"monthly": bson.A{
				bson.M{"$group": bson.M{
					"_id": bson.M{
						"m": bson.M{"$month": bson.M{"date": "$dateParsed", "timezone": timezone}},
						"t": "$categoryDoc.type",
					},
					"amount": bson.M{"$sum": "$amount"},
				}},
				bson.M{"$group": bson.M{
					"_id": "$_id.m",
					"expense": bson.M{"$sum": bson.M{"$cond": bson.A{
						bson.M{"$eq": bson.A{"$_id.t", "expense"}}, "$amount", 0,
					}}},
					"income": bson.M{"$sum": bson.M{"$cond": bson.A{
						bson.M{"$eq": bson.A{"$_id.t", "income"}}, "$amount", 0,
					}}},
				}},
				bson.M{"$addFields": bson.M{
					"net": bson.M{"$subtract": bson.A{"$income", "$expense"}},
				}},
				bson.M{"$project": bson.M{
					"_id":     0,
					"month":   "$_id",
					"expense": 1,
					"income":  1,
					"net":     1,
				}},
				bson.M{"$sort": bson.M{"month": 1}},
			},

			"summary": bson.A{
				bson.M{"$group": bson.M{
					"_id":   "$categoryDoc.type",
					"total": bson.M{"$sum": "$amount"},
				}},
				bson.M{"$group": bson.M{
					"_id": nil,
					"totalExpense": bson.M{"$sum": bson.M{"$cond": bson.A{
						bson.M{"$eq": bson.A{"$_id", "expense"}}, "$total", 0,
					}}},
					"totalIncome": bson.M{"$sum": bson.M{"$cond": bson.A{
						bson.M{"$eq": bson.A{"$_id", "income"}}, "$total", 0,
					}}},
				}},
				bson.M{"$project": bson.M{"_id": 0, "totalExpense": 1, "totalIncome": 1}},
			},

			"byCategory": bson.A{
				bson.M{"$match": bson.M{"categoryDoc.type": "expense"}},
				bson.M{"$group": bson.M{
					"_id":          "$categoryDoc._id",
					"categoryName": bson.M{"$first": "$categoryDoc.name"},
					"total":        bson.M{"$sum": "$amount"},
					"count":        bson.M{"$sum": 1},
				}},
				bson.M{"$project": bson.M{
					"_id":          0,
					"categoryId":   "$_id",
					"categoryName": 1,
					"total":        1,
					"count":        1,
				}},
				bson.M{"$sort": bson.M{"total": -1}},
			},
		}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to compute report"})
		return
	}
	defer cursor.Close(ctx)

	var facets []bson.M
	if err = cursor.All(ctx, &facets); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse report"})
		return
	}

	monthly := make([]YearlyMonthly, 0, 12)
	summary := YearlySummary{
		MaxExpenseMonth: MonthAmount{Month: 0, Amount: 0},
		MinExpenseMonth: MonthAmount{Month: 0, Amount: 0},
	}
	byCategory := []YearlyByCategory{}

	if len(facets) > 0 {
		facet := facets[0]

		summaryDocs := toBsonMArray(facet["summary"])
		if len(summaryDocs) > 0 {
			summary.TotalExpense = toFloat64(summaryDocs[0]["totalExpense"])
			summary.TotalIncome = toFloat64(summaryDocs[0]["totalIncome"])
		}
		summary.Net = summary.TotalIncome - summary.TotalExpense
		summary.AvgMonthlyExpense = summary.TotalExpense / 12

		monthlyMap := make(map[int]YearlyMonthly)
		for _, doc := range toBsonMArray(facet["monthly"]) {
			month := toInt(doc["month"])
			expense := toFloat64(doc["expense"])
			income := toFloat64(doc["income"])
			monthlyMap[month] = YearlyMonthly{
				Month:   month,
				Expense: expense,
				Income:  income,
				Net:     income - expense,
			}
		}

		for m := 1; m <= 12; m++ {
			item, ok := monthlyMap[m]
			if !ok {
				item = YearlyMonthly{Month: m}
			}
			item.Net = item.Income - item.Expense
			monthly = append(monthly, item)
		}

		if summary.TotalExpense > 0 && len(monthly) > 0 {
			maxMonth := monthly[0]
			minMonth := monthly[0]
			for _, item := range monthly[1:] {
				if item.Expense > maxMonth.Expense {
					maxMonth = item
				}
				if item.Expense < minMonth.Expense {
					minMonth = item
				}
			}
			summary.MaxExpenseMonth = MonthAmount{Month: maxMonth.Month, Amount: maxMonth.Expense}
			summary.MinExpenseMonth = MonthAmount{Month: minMonth.Month, Amount: minMonth.Expense}
		}

		for _, doc := range toBsonMArray(facet["byCategory"]) {
			total := toFloat64(doc["total"])
			percent := 0.0
			if summary.TotalExpense > 0 {
				percent = total / summary.TotalExpense * 100
			}
			byCategory = append(byCategory, YearlyByCategory{
				CategoryID:   toString(doc["categoryId"]),
				CategoryName: toString(doc["categoryName"]),
				Total:        total,
				Percent:      percent,
				Count:        toInt64(doc["count"]),
				AvgMonthly:   total / 12,
			})
		}
	}

	c.JSON(http.StatusOK, YearlyReportResponse{
		Year:       year,
		Summary:    summary,
		Monthly:    monthly,
		ByCategory: byCategory,
	})
}

func toBsonMArray(value interface{}) []bson.M {
	if value == nil {
		return nil
	}
	var raw []interface{}
	switch v := value.(type) {
	case bson.A:
		raw = []interface{}(v)
	case []interface{}:
		raw = v
	default:
		return nil
	}

	out := make([]bson.M, 0, len(raw))
	for _, item := range raw {
		switch doc := item.(type) {
		case bson.M:
			out = append(out, doc)
		case map[string]interface{}:
			out = append(out, bson.M(doc))
		}
	}
	return out
}

func toFloat64(value interface{}) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int32:
		return float64(v)
	case int64:
		return float64(v)
	case int16:
		return float64(v)
	case int8:
		return float64(v)
	case uint:
		return float64(v)
	case uint32:
		return float64(v)
	case uint64:
		return float64(v)
	case primitive.Decimal128:
		parsed, err := strconv.ParseFloat(v.String(), 64)
		if err != nil {
			return 0
		}
		return parsed
	default:
		return 0
	}
}

func toInt(value interface{}) int {
	switch v := value.(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	case float32:
		return int(v)
	case uint:
		return int(v)
	case uint32:
		return int(v)
	case uint64:
		return int(v)
	default:
		return 0
	}
}

func toInt64(value interface{}) int64 {
	switch v := value.(type) {
	case int64:
		return v
	case int32:
		return int64(v)
	case int:
		return int64(v)
	case float64:
		return int64(v)
	case float32:
		return int64(v)
	case uint:
		return int64(v)
	case uint32:
		return int64(v)
	case uint64:
		return int64(v)
	default:
		return 0
	}
}

func toString(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case primitive.ObjectID:
		return v.Hex()
	default:
		return ""
	}
}
