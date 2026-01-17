package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Category struct {
	ID    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name  string             `bson:"name" json:"name" binding:"required"`
	Type  string             `bson:"type" json:"type"` // "income" 或 "expense" (選填，用於分類顯示)
	// Order: 用於排序分類標籤
	Order int `bson:"order" json:"order"`
	// Owner: 這個類別的擁有者
	Owner string `bson:"owner" json:"owner"`
}
