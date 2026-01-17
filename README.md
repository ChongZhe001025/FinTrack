# FinTrack 專案開發與維運筆記

## 1. 專案概觀 (Project Overview)

**FinTrack** 是一個使用 React (Frontend) 與 Go (Backend) 開發的個人理財追蹤應用程式，採用 MongoDB 作為資料庫。

### 核心功能

* **收支管理**：記錄收入與支出，支援編輯與刪除。
* **分類系統**：內建預設種子分類，並支援自訂分類。
* **儀表板 (Dashboard)**：
* 收支餘額總覽。
* 近期趨勢圖（7天、本月、自訂區間）。
* 類別佔比圓餅圖 (Pie Chart)。


* **響應式設計**：桌面端側邊欄、行動端底部導航。

### 技術堆疊 (Tech Stack)

| 領域 | 技術/工具 | 詳細組件 |
| --- | --- | --- |
| **Frontend** | React | TypeScript, Vite, Tailwind CSS, Recharts, Lucide |
| **Backend** | Go | Gin Framework, Swaggo (API Docs) |
| **Database** | MongoDB | Docker Compose, Mongo Express (GUI) |

---

## 2. 快速啟動 (Quick Start)

### 前置需求

* Node.js (LTS)
* Go (參考 `server/go.mod`)
* Docker (用於運行 MongoDB)

### 啟動步驟

1. **啟動資料庫服務**
```bash
docker compose up -d

```


2. **建置前端 (Production)**
```bash
cd client
npm install
npm run build

```


3. **啟動後端 API (同時提供前端靜態檔案)**
```bash
cd server
go run .

```



### 服務端口 (Ports)

* **Web App / API Server**: `http://localhost:8080`
* **Swagger API Docs**: `http://localhost:8080/swagger/index.html`
* **Mongo Express (Admin GUI)**: `http://localhost:8081` (帳號/密碼: admin/pass)
* **MongoDB**: `mongodb://localhost:27017`

---

## 3. MongoDB 資料庫維運操作 (重點整理)

此區塊包含完整的備份（Dump）、還原（Restore）與資料匯出（Export）指令。

### 方法一：完整備份與還原 (Binary Dump/Restore)

適用於系統遷移或完整資料備份。

#### 1. 打包匯出 (Backup)

先在容器內產生檔案，再複製到本機。

```bash
# 1. 在容器內執行 dump (假設容器名稱為 mongodb)
docker exec -i mongodb mongodump --db fintrack_db --out /data/dump

# 2. 將備份從容器複製到本機 (./my_docker_backup)
docker cp mongodb:/data/dump ./my_docker_backup

```

#### 2. 還原匯入 (Restore)

先將檔案複製進容器，再執行還原。

```bash
# 1. 將本機備份檔複製進容器
docker cp ./my_docker_backup mongodb:/data/restore_data

# 2. 執行還原 (--drop 會先刪除舊資料庫，確保資料一致)
docker exec -i mongodb mongorestore --drop /data/restore_data

```

### 方法二：匯出可讀格式 (JSON/CSV)

適用於數據分析（Excel）或輕量級備份。

> **注意**：以下指令若在**本機**執行，需安裝 `mongo-tools`。若本機無工具，需加上 `docker exec -i mongodb` 前綴在容器內執行。

#### 1. 匯出為 JSON

```bash
# --jsonArray: 輸出為陣列格式
# --pretty: 格式化縮排
mongoexport --db fintrack_db --collection transactions --out transactions.json --jsonArray --pretty

```

#### 2. 匯出為 CSV (Excel 可開)

```bash
# CSV 必須指定需要的欄位 (fields)
mongoexport --db fintrack_db \
  --collection transactions \
  --type=csv \
  --fields date,category,amount,type,note \
  --out transactions.csv

```

---

## 4. API 摘要

**Base Path**: `/api/v1`

* **Transactions**: `GET /transactions`, `POST /create`, `PUT /:id`, `DELETE /:id`
* **Stats**: `GET /stats` (總覽), `GET /stats/category` (分類統計)
* **Categories**: `GET /categories`, `POST /create`
* **System**: `GET /ping`

---

## 5. 開發注意事項

* **自動種子資料 (Seeding)**：若 `categories` collection 為空，API 啟動時會自動寫入預設分類。
* **資料庫設定**：連線設定位於 `server/config/db.go`。
* **前端連線**：前端預設呼叫 `localhost:8080`，若更改後端 Port，需同步修改 `client/src` 中的 API 設定。
