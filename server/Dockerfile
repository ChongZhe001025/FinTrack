FROM golang:1.25.5

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o fintrack-server .

EXPOSE 8080
ENV PORT=8080

CMD ["/app/fintrack-server"]
