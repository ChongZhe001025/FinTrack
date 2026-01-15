package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Category struct {
	ID   primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name string             `bson:"name" json:"name" binding:"required"`
	Type string             `bson:"type" json:"type"` // "income" 或 "expense" (選填，用於分類顯示)
}
