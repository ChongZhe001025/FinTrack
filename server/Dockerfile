FROM node:20 AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client .
RUN npm run build

FROM golang:1.25.5 AS server-build

WORKDIR /app
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server .
RUN CGO_ENABLED=0 go build -o fintrack-server .

FROM alpine:3.20

WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=server-build /app/fintrack-server /app/fintrack-server
COPY --from=client-build /app/client/dist /app/client/dist

EXPOSE 8080
ENV PORT=8080

CMD ["/app/fintrack-server"]
