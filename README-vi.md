# Chuỗi Proxy HTTP đến SOCKS5

🤖 **Được hỗ trợ bởi AI** | Được xây dựng với [Cursor](https://cursor.sh/) - *Tương lai của lập trình đã đến!*

Một giải pháp quản lý proxy mạnh mẽ kết nối các giao thức HTTP và SOCKS5, bao gồm tiện ích mở rộng Chrome để cấu hình và điều khiển một cách liền mạch.

![Proxy Chain](chrome-extension/images/icon128.png)

## Tổng quan

Dự án này cho phép bạn sử dụng proxy SOCKS5 với các ứng dụng chỉ hỗ trợ proxy HTTP. Nó bao gồm hai thành phần:

1. **Máy chủ Proxy Node.js**: Tạo một máy chủ proxy HTTP chuyển tiếp các yêu cầu đến proxy SOCKS5 có thể cấu hình
2. **Tiện ích mở rộng Chrome**: Cung cấp giao diện thân thiện để quản lý cấu hình proxy và điều khiển máy chủ proxy

## Tính năng

- 🔄 **Chuyển đổi Giao thức**: Chuyển đổi giữa các giao thức proxy HTTP và SOCKS5
- 🔒 **Hỗ trợ Xác thực**: Sử dụng proxy yêu cầu xác thực tên người dùng/mật khẩu
- 📋 **Quản lý Proxy**: Lưu và tổ chức nhiều cấu hình proxy
- 🌐 **Proxy theo Trang web**: Áp dụng proxy chỉ cho các tên miền cụ thể
- ⏭️ **Quy tắc Bỏ qua**: Cấu hình các tên miền để bỏ qua proxy
- 🔄 **Tích hợp Chrome**: Tự động cấu hình cài đặt proxy của Chrome
- ☁️ **Đồng bộ Trình duyệt**: Đồng bộ hóa cài đặt proxy trên các trình duyệt với cùng tài khoản Google
- 🚦 **Chỉ báo Trạng thái**: Chỉ báo trực quan cho trạng thái kết nối proxy

## Cài đặt

### Yêu cầu

- [Node.js](https://nodejs.org/) (v14 trở lên)
- Trình duyệt [Google Chrome](https://www.google.com/chrome/)

### Máy chủ Proxy Node.js

1. Sao chép repository này:
   ```bash
   git clone https://github.com/yourusername/http-to-socks-proxy.git
   cd http-to-socks-proxy
   ```

2. Cài đặt các phụ thuộc:
   ```bash
   npm install
   ```

3. Khởi động máy chủ proxy:
   ```bash
   npm start
   ```

### Tiện ích mở rộng Chrome

1. Mở Chrome và điều hướng đến `chrome://extensions/`
2. Bật "Developer mode" (chuyển đổi ở góc trên bên phải)
3. Nhấp "Load unpacked" và chọn thư mục `chrome-extension` từ dự án này
4. Biểu tượng tiện ích mở rộng Proxy Manager sẽ xuất hiện trên thanh công cụ trình duyệt

## Sử dụng

### Hoạt động Cơ bản

1. Nhấp vào biểu tượng Proxy Manager trên thanh công cụ Chrome
2. Cấu hình proxy của bạn:
   - Chọn một proxy đã lưu từ danh sách, hoặc
   - Tạo cấu hình proxy mới bằng cách nhập chi tiết:
     - Loại (SOCKS5, HTTP, hoặc HTTPS)
     - Tên (để dễ nhận dạng)
     - Host và Port
     - Tên người dùng và Mật khẩu (nếu cần)
3. Nhấp "Connect" để kích hoạt proxy
4. Biểu tượng tiện ích mở rộng sẽ hiển thị trạng thái proxy hiện tại

### Định dạng URL Proxy Đầy đủ

Bạn có thể dán trực tiếp URL proxy đầy đủ theo định dạng sau:
```
socks5://username:password@host:port
```

### Chế độ Proxy theo Trang web

Để áp dụng proxy chỉ cho một trang web cụ thể:

1. Điều hướng đến trang web bạn muốn proxy
2. Nhấp vào biểu tượng tiện ích mở rộng Proxy Manager
3. Nhấp "Connect for [current site] only"
4. Proxy sẽ chỉ hoạt động cho tên miền đó và các tên miền con

### Quy tắc Bỏ qua

Để cấu hình các tên miền nên bỏ qua proxy:

1. Nhấp vào biểu tượng cài đặt (bánh răng) trong popup tiện ích mở rộng
2. Thêm các mẫu tên miền để bỏ qua, mỗi dòng một mẫu (ví dụ: `*.example.com`, `domain.net`)
3. Cài đặt sẽ được lưu tự động

## Cô lập nhiều instance

Mỗi bản cài extension Chrome có một `instanceId` ngẫu nhiên (lưu trong `chrome.storage.local`).

- Connect/disconnect chỉ ảnh hưởng session Node.js của **instance đó**
- Mỗi instance có port proxy local riêng (tự gán)
- Trạng thái kết nối lưu ở storage **local** (không sync), nên profile này không ghi đè profile khác

## Tài liệu API

### API Máy chủ Proxy Node.js

Máy chủ Node.js cung cấp API điều khiển trên `http://127.0.0.1:9998`.

Các endpoint thay đổi trạng thái đều yêu cầu `instanceId` để nhiều extension instance dùng chung 1 control server an toàn.

#### GET /status

Không có `instanceId`: trả về tổng hợp tất cả session.
Có `?instanceId=...`: trả về session của instance đó.

#### POST /config

Body:
```json
{
  "instanceId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "upstreamProxyUrl": "socks5://user:pass@host:port"
}
```

#### POST /stop

Chỉ dừng session của `instanceId` được chỉ định. Các instance khác vẫn chạy.

Body:
```json
{
  "instanceId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Lưu trữ Tiện ích mở rộng Chrome

- Cấu hình proxy (sync hoặc local theo toggle)
- Bypass list (sync)
- Trạng thái kết nối theo instance (local)
- ID ngẫu nhiên + local proxy address theo instance (local)

## Cấu hình

### Cấu hình Máy chủ Node.js

- `CONTROL_PORT`: Port API điều khiển (mặc định: 9998)
- `CONTROL_HOST`: Host API điều khiển (mặc định: 127.0.0.1)
- `LOCAL_PROXY_HOST`: Host cho relay HTTP từng instance (mặc định: 127.0.0.1)

Port relay local được gán tự động cho từng instance.

Ví dụ:
```bash
CONTROL_PORT=9998 npm start
```

## Kiến trúc

### Các Thành phần Hệ thống

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Chrome Browser │◄────►│   Node.js App   │◄────►│  SOCKS5 Proxy   │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        ▲                       ▲
        │                       │
        │                       │
        ▼                       │
┌─────────────────┐             │
│                 │             │
│ Chrome Extension│─────────────┘
│                 │  Control API
└─────────────────┘
```

### Luồng Dữ liệu

1. Tiện ích mở rộng Chrome cấu hình Ứng dụng Node.js qua Control API
2. Trình duyệt Chrome kết nối đến proxy HTTP của Ứng dụng Node.js
3. Ứng dụng Node.js chuyển tiếp yêu cầu đến proxy SOCKS5 đã cấu hình
4. Proxy SOCKS5 kết nối đến các máy chủ đích

## Kiểm thử

Để kiểm tra thiết lập proxy:

1. Khởi động máy chủ Node.js:
   ```bash
   npm start
   ```

2. Cấu hình proxy qua tiện ích mở rộng Chrome

3. Truy cập [https://www.whatismyip.com](https://www.whatismyip.com) để xác minh IP của bạn đã thay đổi

## Khắc phục Sự cố

### Các Vấn đề Thường gặp

#### Kết nối Proxy Thất bại

- Kiểm tra xem proxy SOCKS5 có trực tuyến và có thể truy cập không
- Xác minh tên người dùng và mật khẩu đúng
- Đảm bảo máy chủ proxy hỗ trợ phương thức xác thực bạn đang sử dụng

#### Tiện ích mở rộng Chrome Không thể Kết nối đến Ứng dụng Node.js

- Xác minh ứng dụng Node.js đang chạy (`npm start`)
- Kiểm tra xem port điều khiển (9998) có thể truy cập không
- Tìm kiếm các thông báo lỗi trong console trình duyệt hoặc console Node.js

#### Proxy Hoạt động Nhưng Một số Trang web Không Tải

- Một số trang web chặn kết nối proxy
- Thử sử dụng chế độ proxy theo trang web cho các trang hoạt động với proxy
- Thêm các tên miền có vấn đề vào danh sách bỏ qua

## Lộ trình

Kế hoạch phát triển tương lai bao gồm:

- Hỗ trợ tiện ích mở rộng Firefox
- Hỗ trợ proxy xoay vòng
- Kiểm tra tốc độ kết nối
- Thống kê và giám sát lưu lượng
- Khả năng chuỗi proxy (nhiều proxy theo chuỗi)
- Hiển thị vị trí địa lý IP

## Đóng góp

Chúng tôi hoan nghênh các đóng góp! Vui lòng gửi Pull Request.

1. Fork repository
2. Tạo nhánh tính năng của bạn (`git checkout -b feature/amazing-feature`)
3. Commit các thay đổi (`git commit -m 'Add some amazing feature'`)
4. Push lên nhánh (`git push origin feature/amazing-feature`)
5. Mở Pull Request

## Giấy phép

Dự án này được cấp phép theo Giấy phép ISC.

## Lời cảm ơn

- Thư viện [proxy-chain](https://www.npmjs.com/package/proxy-chain) để xử lý chức năng máy chủ proxy
- Tài liệu Chrome Extensions cho tích hợp trình duyệt 