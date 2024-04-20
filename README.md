## Yêu cầu hệ thống

-   [Node.js](https://nodejs.org/en/) (phiên bản 18 trở lên)
-   [MongoDB](https://www.mongodb.com/try/download/community) (phiên bản 6 trở lên)
-   ANH EM DÙNG YARN NHÁ
-   Nếu chưa có Yarn thì chạy lệnh

```
   npm i -g yarn
```

Sau đó check lại bằng lệnh

```
   yarn -v
```

### Installation

1. Clone the repo

```
   git clone https://github.com/SE114-QuizApp/QuizApp-BE.git
```

2. Install packages

```
   yarn
```

## Cấu hình

1. Tạo tệp tin `.env` trong thư mục gốc của dự án.
2. Đặt các biến môi trường sau trong tệp tin `.env`
3. Add .env file:

```
   PORT=4000
   CONNECTION_STRING=mongodb://127.0.0.1:27017/Quizzes_App
   EXPRISES_TIME='100 days'
   ACCESS_TOKEN_SECRET='jwttoken123'
   REFRESH_TOKEN_SECERT='jwtrefreshtoken123'
```

## Sử dụng

1. Khởi động server API:

```
yarn start
```

2. Server API sẽ chạy tại `http://localhost:4000` (hoặc cổng đã chỉ định trong file .env).
