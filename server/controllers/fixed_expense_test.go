package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"server/config"
	"server/models"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// MockAuthMiddleware for testing
func MockAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("currentUser", "testuser")
		c.Next()
	}
}

func TestCreateFixedExpense(t *testing.T) {
	// Setup Test DB
	os.Setenv("DB_NAME", "fintrack_test")
	config.ConnectDB()

	// Setup Gin
	gin.SetMode(gin.TestMode)
	r := gin.Default()
	r.Use(MockAuthMiddleware())
	r.POST("/fixed-expenses", CreateFixedExpense)

	// Create payload
	payload := models.FixedExpense{
		Amount:     1000,
		CategoryID: primitive.NewObjectID(),
		Note:       "Test Rent Unit Test",
		Day:        time.Now().Day(),
	}
	jsonValue, _ := json.Marshal(payload)

	// Create Request
	req, _ := http.NewRequest("POST", "/fixed-expenses", bytes.NewBuffer(jsonValue))
	req.Header.Set("Content-Type", "application/json")

	// Record Response
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Assertions
	assert.Equal(t, 200, w.Code)

	var response models.FixedExpense
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.Nil(t, err)
	assert.Equal(t, payload.Amount, response.Amount)
	assert.Equal(t, payload.Day, response.Day)
}
