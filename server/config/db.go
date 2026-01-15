package config

import (
	"context"
	"fmt"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// DB 是一個全域變數，用來儲存 MongoDB 的連線實例
var DB *mongo.Client

// ConnectDB 初始化資料庫連線
func ConnectDB() {
	// 1. 設定連線資訊 (對應 docker-compose 的帳號密碼)
	// 如果是本地開發，Docker 映射出來的 port 是 27017
	uri := "mongodb://root:password@localhost:27017/"

	// 2. 設定連線超時 (Context)，如果 10 秒連不上就報錯，避免程式卡死
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// 3. 建立連線
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatal("無法建立 MongoDB 客戶端: ", err)
	}

	// 4. Ping 資料庫 (確保真的連上了)
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatal("無法連接到 MongoDB (Ping 失敗): ", err)
	}

	fmt.Println("✅ 成功連接到 MongoDB!")

	// 5. 賦值給全域變數
	DB = client
}

// GetCollection 是一個輔助函數，方便我們快速取得指定的 Collection
func GetCollection(collectionName string) *mongo.Collection {
	// "fintrack_db" 是我們的資料庫名稱
	return DB.Database("fintrack_db").Collection(collectionName)
}
