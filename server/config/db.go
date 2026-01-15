package config

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var DB *mongo.Client

var DBName string

func ConnectDB() {
	uri := os.Getenv("MONGO_URI")

	if uri == "" {
		uri = "mongodb://root:password@localhost:27017/"
		fmt.Println("⚠️  未檢測到 MONGO_URI，使用本地開發預設值")
	}

	DBName = os.Getenv("DB_NAME")
	if DBName == "" {
		DBName = "fintrack_db"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatal("無法建立 MongoDB 客戶端: ", err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatal("無法連接到 MongoDB (Ping 失敗): ", err)
	}

	fmt.Printf("✅ 成功連接到 MongoDB! (DB: %s)\n", DBName)

	DB = client
}

// GetCollection 是一個輔助函數
func GetCollection(collectionName string) *mongo.Collection {
	// 使用動態設定的 DBName，而不是寫死的字串
	return DB.Database(DBName).Collection(collectionName)
}
