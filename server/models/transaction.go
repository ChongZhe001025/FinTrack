package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Transaction 代表一筆記帳資料
type Transaction struct {
	// ID: MongoDB 自動生成的唯一識別碼
	// omitempty: 如果是空的 (建立時) 就不傳這個欄位給 MongoDB，讓它自己生
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id"`

	// Type: "income" 或 "expense"
	// binding:"required": Gin 會幫我們檢查這個欄位必填
	Type string `bson:"type" json:"type" binding:"required,oneof=income expense" example:"expense"`

	// Amount: 金額
	Amount float64 `bson:"amount" json:"amount" binding:"required" example:"150"`

	// Category: 類別 (如: Food, Transport)
	Category string `bson:"category" json:"category" binding:"required" example:"Food"`

	// Date: 日期字串 "YYYY-MM-DD"
	// 為了配合前端傳來的格式，我們先用 string 存，方便處理
	Date string `bson:"date" json:"date" binding:"required" example:"2026-01-14"`

	// Note: 備註 (選填)
	Note string `bson:"note" json:"note" example:"午餐吃牛肉麵"`

	// CreatedAt: 建立時間
	CreatedAt time.Time `bson:"created_at" json:"created_at"`

	// UpdatedAt: 更新時間
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}
