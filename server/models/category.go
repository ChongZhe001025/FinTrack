package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Category struct {
	ID    primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name  string             `bson:"name" json:"name" binding:"required"`
	Type  string             `bson:"type" json:"type"`   // "income" | "expense"
	Order int                `bson:"order" json:"order"` // sorting
	Owner string             `bson:"owner" json:"-"`     // do not expose
}
