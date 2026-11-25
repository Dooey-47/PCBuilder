# PCBuilder

Website bán máy tính bằng React, Bootstrap, Express, PostgreSQL và Prisma 7.

## Yêu cầu

- Node.js 24 LTS và npm
- PostgreSQL đã được cài đặt và đang chạy trên máy
- Git


## Thiết lập lần đầu

1. Clone repository và mở terminal tại thư mục gốc của dự án.
2. Mở SQL Shell (psql), đăng nhập bằng tài khoản quản trị PostgreSQL và chạy các lệnh sau một lần. Thay `YOUR_PASSWORD` bằng mật khẩu của bạn:

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
Trang chủ sẽ hiển thị danh sách sản phẩm. Mở chi tiết, đăng ký tài khoản, thêm vào giỏ và thử đặt hàng COD.
Địa chỉ kiểm tra trạng thái API là http://localhost:3000/api/health.

## Sau khi pull thay đổi

Chạy `npm ci` trong từng thư mục có thay đổi về thư viện phụ thuộc. Trong thư mục `server`, chạy:

```sh
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

Khi sửa schema, tạo migration có tên mô tả bằng `npx prisma migrate dev --name describe_change`, tạo lại Prisma Client và commit cả `prisma/schema.prisma` lẫn `prisma/migrations/`.

Migration đồng bộ cấu trúc cơ sở dữ liệu. Script seed thêm năm danh mục và sáu sản phẩm minh họa, không tạo trùng hoặc ghi đè các bản ghi đã có. Chạy seed sau khi thiết lập hoặc sau khi pull thay đổi của script. Không commit tệp `.env` chứa thông tin thật hoặc thông tin đăng nhập.

## Sprint 1

- Danh sách và chi tiết sản phẩm; chọn danh mục; xem tồn kho, bảo hành và thông số.
- Đăng ký, đăng nhập, đăng xuất; sửa họ tên và số điện thoại.
- Backend kiểm tra quyền Customer/Admin; Admin có trang tổng quan chỉ xem.
- Session lưu trong PostgreSQL; mật khẩu được băm; kiểm tra CSRF và giới hạn tần suất đăng ký/đăng nhập.

Để tạo Admin dùng thử, điền cả `DEMO_ADMIN_EMAIL` và `DEMO_ADMIN_PASSWORD` vào `server/.env` trước khi chạy seed. Dùng email chưa được đăng ký làm Customer và mật khẩu dài 8–128 ký tự. Không có mật khẩu mặc định dùng chung. Chạy lại seed không đặt lại mật khẩu. Tài khoản Customer được đăng ký trên giao diện.

Kiểm tra frontend: chạy `npm test`, `npm run lint` và `npm run build` trong `client`.
Kiểm thử backend: chạy `npm test` trong `server`. Kiểm thử mật khẩu luôn chạy; kiểm thử tích hợp cần đặt `TEST_DATABASE_URL` trong `server/.env`. Tài khoản cơ sở dữ liệu cần quyền tạo schema. Kiểm thử tích hợp tạo và xóa schema tạm riêng, không sửa các bảng đã có.

Xem [SPRINT1.md](SPRINT1.md) cho phần nền tảng và [SPRINT2.md](SPRINT2.md) cho bản cập nhật mới nhất.

## Sprint 2

- Tìm theo từ khóa; lọc danh mục, thương hiệu, giá, thông số, nhu cầu và tồn kho; sắp xếp kết quả.
- Giỏ hàng lưu theo tài khoản; backend kiểm tra số lượng và tính tổng tiền.
- Admin thêm/sửa/ẩn sản phẩm, quản lý danh mục/thương hiệu, cập nhật tồn kho và tải ảnh lên. Phiên bản sản phẩm giúp tránh ghi đè dữ liệu mới bằng form cũ.
- Đặt hàng COD: kiểm tra giá/tồn mới nhất, trừ kho và tạo đơn trong cùng transaction, chống tạo đơn trùng khi gửi lại, lưu thông tin mua hàng tại thời điểm đặt và chỉ cho đọc đơn của chính mình.

Để cập nhật từ Sprint 1, chép các tệp mới/thay đổi vào đúng đường dẫn, giữ `.env` riêng. Trong `server`, chạy lần lượt `npm ci`, `npx prisma migrate dev`, `npx prisma generate`, `npx prisma db seed`, rồi `npm run dev`. Trong terminal khác, vào `client`, chạy `npm ci` và `npm run dev`. Không cần reset cơ sở dữ liệu.

Biến `SHIPPING_FEE_VND` trong `server/.env` đặt phí giao hàng cố định, mặc định 30000 VND. Ảnh tải lên lưu ở `server/uploads/` và không được đưa vào Git; cũng có thể dùng URL ảnh HTTPS. Ảnh và dữ liệu trên máy từng thành viên không tự đồng bộ. Khi mất phản hồi đặt hàng, dùng nút Retry this checkout để lấy lại kết quả với cùng khóa, kể cả sau khi tải lại trang.

API mới nằm trong `server/src/catalog.js`, `admin-catalog.js` và `commerce.js`, được đăng ký tại `app.js`. Hủy đơn, mô phỏng thanh toán và xử lý giao hàng thuộc Sprint 3. Xem [SPRINT2.md](SPRINT2.md) để biết chi tiết và tiêu chí kiểm tra.
