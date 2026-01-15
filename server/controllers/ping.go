package controllers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// PingExample godoc
// @Summary      健康檢查
// @Description  回傳 Pong 確認伺服器存活
// @Tags         System
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]string
// @Router       /ping [get]
func Ping(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "pong",
	})
}
