package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// 1. 定義多組使用者 (帳號 -> 密碼)
var USERS = map[string]string{
	"chongzhe": "20001025Jonas",
	"yunchen":  "20000722Jenny",
	"moon":     "19670706Moon",
}

const COOKIE_NAME = "fintrack_session"

type LoginInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Login 登入
func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "請輸入帳號密碼"})
		return
	}

	// 2. 檢查帳號是否存在，以及密碼是否正確
	validPassword, exists := USERS[input.Username]
	if !exists || validPassword != input.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "帳號或密碼錯誤"})
		return
	}

	// 3. 登入成功：將「使用者名稱」存入 Cookie
	// SetCookie(name, value, maxAge(秒), path, domain, secure, httpOnly)
	// 3600*24*7 = 7天過期
	// HttpOnly=true: 防止 XSS 攻擊 (JS 讀不到)
	c.SetCookie(COOKIE_NAME, input.Username, 3600*24*7, "/", "", false, true)

	c.JSON(http.StatusOK, gin.H{"message": "登入成功", "user": input.Username})
}

// Logout 登出
func Logout(c *gin.Context) {
	// 將 Cookie 時間設為 -1 即為刪除
	c.SetCookie(COOKIE_NAME, "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "已登出"})
}

// CheckAuth 檢查登入狀態 (給前端用)
func CheckAuth(c *gin.Context) {
	username, err := c.Cookie(COOKIE_NAME)
	if err != nil || username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
		return
	}
	if _, exists := USERS[username]; !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"authenticated": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"authenticated": true, "user": username})
}

// Middleware: AuthRequired
func AuthRequired(c *gin.Context) {
	username, err := c.Cookie(COOKIE_NAME)

	// 如果沒有 Cookie 或內容不對，直接擋下
	if err != nil || username == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未授權"})
		return
	}

	if _, exists := USERS[username]; !exists {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "未授權"})
		return
	}

	// 把 currentUser 存入 Context，讓後面的 API 知道是誰在操作
	c.Set("currentUser", username)
	c.Next() // 通過驗證，繼續執行
}
