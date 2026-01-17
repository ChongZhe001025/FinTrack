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

	// Amount: 金額
	Amount float64 `bson:"amount" json:"amount" binding:"required" example:"150"`

	// CategoryID: 類別 ID
	CategoryID primitive.ObjectID `bson:"category_id" json:"category_id" binding:"required" example:"64cfe3f1f1f1f1f1f1f1f1f1"`

	// Date: 日期字串 "YYYY-MM-DD"
	// 為了配合前端傳來的格式，我們先用 string 存，方便處理
	Date string `bson:"date" json:"date" binding:"required" example:"2026-01-14"`

	// Note: 備註 (選填)
	Note string `bson:"note" json:"note" example:"午餐吃牛肉麵"`

	// Owner: 這筆資料的擁有者
	Owner string `bson:"owner" json:"owner"`

	// CreatedAt: 建立時間
	CreatedAt time.Time `bson:"created_at" json:"created_at"`

	// UpdatedAt: 更新時間
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}
