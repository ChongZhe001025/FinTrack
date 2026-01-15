# FinTrack

Personal finance tracker with transactions, dashboards, and category insights. Built with React, Go, and MongoDB.

## Features
- Record income and expense transactions with edit and delete
- Category management with default seeds and custom categories
- Dashboard with income, expense, balance, and expense trend (7 days, this month, custom range)
- Category breakdown pie chart
- Responsive layout with desktop sidebar and mobile bottom navigation
- Swagger API docs

## Tech Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide
- Backend: Go, Gin, MongoDB, Swaggo
- Dev: Docker Compose (MongoDB, Mongo Express)

## Project Structure
- client/ frontend app
- server/ backend API
- docker-compose.yml local MongoDB and Mongo Express
- mongo_data/ local database volume (ignored)

## Quick Start
Prereqs: Node.js (LTS), Go (see `server/go.mod`), Docker (optional for MongoDB).

1. Start MongoDB
```bash
docker compose up -d
```

2. Start API server
```bash
cd server
go run .
```

3. Start web app
```bash
cd client
npm install
npm run dev
```

Open the app at `http://localhost:5173`.

## Ports
- Frontend: `http://localhost:5173`
- API: `http://localhost:8080`
- Swagger UI: `http://localhost:8080/swagger/index.html`
- MongoDB: `mongodb://localhost:27017`
- Mongo Express: `http://localhost:8081` (admin/pass)

## API Summary
Base path: `/api/v1`
- `GET /ping`
- `GET /transactions`
- `POST /transactions`
- `PUT /transactions/:id`
- `DELETE /transactions/:id`
- `GET /stats`
- `GET /stats/category`
- `GET /categories`
- `POST /categories`

## Notes
- The API seeds default categories on startup if the categories collection is empty.
- MongoDB connection settings live in `server/config/db.go`.
- The frontend calls the API at `http://localhost:8080` (update URLs in `client/src` if you change the API host).
