# PCBuilder

Website bán máy tính xây dựng = React, Bootstrap, Express, PostgreSQL và Prisma 7.

## Yêu cầu

- Node.js 24 LTS & npm
- PostgreSQL đã được cài đặt & đang chạy trên máy
- Git

Mỗi thành viên chạy frontend, backend và cơ sở dữ liệu riêng trên máy của mình.

## Thiết lập lần đầu

1. Clone repository và mở terminal tại thư mục gốc của dự án.
2. Mở SQL Shell (psql), đăng nhập bằng tài khoản quản trị PostgreSQL và chạy các lệnh sau một lần. Thay `YOUR_PASSWORD` bằng mật khẩu Postgre của bạn:

   ```sql
   CREATE ROLE pcstore_dev WITH LOGIN CREATEDB PASSWORD 'YOUR_PASSWORD';
   CREATE DATABASE pcstore OWNER pcstore_dev;
   ```

   Tài khoản này dùng để phát triển trên máy cá nhân. Quyền `CREATEDB` cho phép Prisma tạo cơ sở dữ liệu tạm (shadow database) để kiểm tra migration.

3. Sao chép `server/.env.example` thành `server/.env`. Điền thông tin kết nối cơ sở dữ liệu vào `DATABASE_URL`, giữ `PORT=3000` và đặt `SESSION_SECRET` riêng:

   ```dotenv
   DATABASE_URL="postgresql://pcstore_dev:YOUR_PASSWORD@localhost:5432/pcstore?schema=public"
   PORT=3000
   SESSION_SECRET="YOUR_GENERATED_SECRET"
   ```

   Mã hóa URL các ký tự đặc biệt trong mật khẩu của chuỗi kết nối. Tạo giá trị cho `SESSION_SECRET` bằng lệnh:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Từ thư mục gốc của dự án, cài các thư viện và khởi tạo cơ sở dữ liệu:

   ```sh
   cd client
   npm ci
   cd ../server
   npm ci
   npx prisma migrate dev
   npx prisma generate
   npx prisma db seed
   ```

## Chạy trên máy cá nhân

Giữ PostgreSQL hoạt động. Mở hai terminal tại thư mục gốc của dự án.

Backend:

```sh
cd server
npm run dev
```

Frontend:

```sh
cd client
npm run dev
```

Mở địa chỉ frontend do Vite hiển thị, thường là http://localhost:5173.
Kết quả kiểm tra kết nối phải hiển thị `"database": "connected"`.
Địa chỉ kiểm tra trạng thái API là http://localhost:3000/api/health.

## Sau khi pull thay đổi

Chạy `npm ci` trong từng thư mục có thay đổi về thư viện phụ thuộc. Trong thư mục `server`, chạy:

```sh
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

Khi sửa schema, tạo migration có tên mô tả bằng `npx prisma migrate dev --name describe_change`, tạo lại Prisma Client và commit cả `prisma/schema.prisma` lẫn `prisma/migrations/`.

Migration đồng bộ cấu trúc cơ sở dữ liệu. Script seed đảm bảo có đủ năm danh mục ban đầu, không tạo trùng hoặc xóa các bản ghi khác. Script không tự đồng bộ thay đổi giữa cơ sở dữ liệu của các thành viên; ID danh mục có thể khác nhau. Cần chạy seed sau khi thiết lập hoặc sau khi pull thay đổi của script seed. Không commit tệp `.env` chứa thông tin thật hoặc thông tin đăng nhập.
