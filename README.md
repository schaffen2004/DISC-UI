# DigiWork DISC UI

## Yêu cầu

- Node.js 20+ (khuyến nghị)
- Backend API DISC đang chạy (mặc định `http://localhost:8001`)

## Khởi chạy

1. Cài dependency:

```bash
npm install
```

2. Tạo file môi trường từ mẫu:

```bash
cp .env.example .env
```

3. Kiểm tra / chỉnh `VITE_API_URL` trong `.env` cho đúng địa chỉ backend:

```env
VITE_API_URL=http://localhost:8001
```

4. Chạy dev server:

```bash
npm run dev
```

5. Mở trình duyệt theo URL Vite in ra terminal (thường `http://localhost:5173`).

## Lệnh khác

```bash
npm run build      # build production
npm run preview    # xem bản build local
npm run lint       # kiểm tra ESLint
```
