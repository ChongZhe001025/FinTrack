package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// FixedExpense 代表每月固定支出
type FixedExpense struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Amount     float64            `bson:"amount" json:"amount" binding:"required"`
	CategoryID primitive.ObjectID `bson:"category_id" json:"category_id" binding:"required"`
	Note       string             `bson:"note" json:"note"`
	Owner      string             `bson:"owner" json:"owner"`
	Day        int                `bson:"day" json:"day" binding:"required,min=1,max=31"` // 每月幾號扣款
	Type       string             `bson:"type" json:"type"`                               // "income" 或 "expense"
	Order      int                `bson:"order" json:"order"`                             // 排序
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}
