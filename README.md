# PCBuilder

Chạy trong client/ & server/: npm ci
Tạo dtb Postgre riêng, copy .env.example tới .env, điền vào thông tin xác nhận riêng & chạy:
    npx prisma migrate dev
    npx prisma generate
    npm run dev


BE: npm run dev trong server/ trong terminal 
FE: npm run dev trong client/ trong terminal (khác)
DB: npx prisma studio trong server/ trong terminal