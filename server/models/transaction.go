// models/transaction.go
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Transaction struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Type       string             `bson:"type" json:"type"` // derived from category.type
	Amount     float64            `bson:"amount" json:"amount" binding:"required"`
	Category   string             `bson:"category" json:"category"` // category name (denormalized)
	CategoryID primitive.ObjectID `bson:"category_id,omitempty" json:"category_id,omitempty"`
	Date       string             `bson:"date" json:"date" binding:"required" example:"2006-01-02"`
	Note       string             `bson:"note" json:"note"`
	Owner      string             `bson:"owner" json:"-"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt  time.Time          `bson:"updated_at" json:"updated_at"`
}
