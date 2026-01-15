package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Budget struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Category  string             `bson:"category" json:"category" binding:"required"`
	Amount    float64            `bson:"amount" json:"amount" binding:"required"`
	YearMonth string             `bson:"year_month" json:"year_month" binding:"required"` // 格式: "2026-01"
}
