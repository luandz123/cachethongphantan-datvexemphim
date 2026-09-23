# KỊCH BẢN THUYẾT TRÌNH BẢO VỆ BÀI TẬP LỚN
## ĐỀ TÀI: HỆ THỐNG ĐẶT VÉ XEM PHIM PHÂN TÁN (DISTRIBUTED MOVIE BOOKING SYSTEM)

> **Tài liệu này được biên soạn dưới dạng kịch bản "cầm tay chỉ việc":** gồm đầy đủ lời mở đầu, lệnh thao tác trên terminal, kết quả màn hình và lời thoại giải thích trước Hội đồng chấm thi/Giáo viên hướng dẫn.

---

## ⏱️ PHẦN MỞ ĐẦU: KHỞI ĐỘNG HỆ THỐNG TRƯỚC HỘI ĐỒNG

- **Thao tác chuẩn bị:**
  Mở terminal tại thư mục dự án và chạy:
  ```bash
  docker compose up -d --build
  ```
- **Kiểm tra trạng thái toàn bộ containers:**
  ```bash
  docker compose ps
  ```
- **Lời giới thiệu:**
  > *"Kính thưa Thầy/Cô và các bạn, hôm nay nhóm em xin trình bày bài tập lớn môn Các Hệ Thống Phân Tán với đề tài: **Hệ thống Đặt vé xem phim Phân tán**. Hệ thống được xây dựng hoàn toàn bằng kiến trúc Microservices gồm 4 dịch vụ độc lập viết bằng NestJS/TypeScript, sử dụng Database-per-service với 2 cơ sở dữ liệu PostgreSQL riêng biệt, kết nối đồng bộ hiệu năng cao bằng gRPC, giao tiếp bất đồng bộ qua RabbitMQ và điều phối tải qua Nginx. Sau đây em xin lần lượt chứng minh 7 đặc trưng cốt lõi của hệ thống phân tán thông qua các kịch bản thực nghiệm trực tiếp."*

---

## 1️⃣ ĐẶC TRƯNG 1: TRANSPARENCY (TÍNH TRONG SUỐT)

### 📌 Mục tiêu:
Chứng minh **Access Transparency** và **Location Transparency**. Client phía ngoài chỉ nhìn thấy duy nhất 1 cổng vào (API Gateway), hoàn toàn không cần biết địa chỉ IP, ngôn ngữ, số lượng máy chủ hay cơ sở dữ liệu phía sau.

### 🖥️ Lệnh chạy:
```bash
./demo/demo-transparency.sh
```

### 📊 Kết quả quan sát:
Terminal trả về HTTP Status `201 Created` kèm JSON chứa:
- `bookingId`: Mã vé tạo bởi `booking-service`
- `movieName`, `seatCode`: Ghế `A20` xác nhận từ `inventory-service`
- `processedByHost`: Container ID nội bộ

### 🎤 Lời thoại thuyết minh trước Giám khảo:
> *"Như Thầy/Cô có thể thấy trên màn hình, phía Client chỉ gửi duy nhất 1 yêu cầu HTTP POST đến địa chỉ `localhost:3000/booking`. Nhưng thực tế ở hậu trường, hệ thống phân tán đã âm thầm kích hoạt một chuỗi quy trình phức tạp:*
> 1. *API Gateway nhận request và gọi gRPC `ReserveSeat` sang **Inventory Service**.*
> 2. *Inventory Service khoá dòng dữ liệu và kiểm tra trên **inventory_db**.*
> 3. *Tiếp theo, **Booking Service** ghi nhận đơn vé vào cơ sở dữ liệu **booking_db** hoàn toàn biệt lập.*
> 4. *Đồng thời một sự kiện được đẩy lên hàng đợi **RabbitMQ** để gửi thông báo.*
> 
> *Toàn bộ vị trí mạng, công nghệ và sự phân mảnh dữ liệu này đều hoàn toàn 'trong suốt' đối với người dùng. Đây chính là minh chứng điển hình cho tính chất **Transparency** trong Hệ thống phân tán."*

---

## 2️⃣ ĐẶC TRƯNG 2: OPENNESS (TÍNH MỞ & TÍNH CHUẨN HOÁ)

### 📌 Mục tiêu:
Chứng minh hệ thống tuân theo các chuẩn giao tiếp mở (Open Standards). Các service không phụ thuộc lẫn nhau về công nghệ mà giao tiếp thông qua giao ước (Interface Definition Language - IDL) chuẩn tắc.

### 🖥️ Thao tác minh hoạ:
Mở và trình chiếu file định nghĩa gRPC:
```bash
cat shared/protos/inventory.proto
cat shared/protos/booking.proto
```

### 📊 Điểm nhấn trên màn hình:
- File `inventory.proto` định nghĩa cú pháp `syntax = "proto3"`.
- Các RPC method: `ReserveSeat(ReserveSeatRequest) returns (ReserveSeatResponse)`.

### 🎤 Lời thoại thuyết minh trước Giám khảo:
> *"Tính chất thứ hai của hệ thống là **Tính Mở (Openness)**. Toàn bộ giao tiếp đồng bộ giữa các microservices được chuẩn hoá bằng **Protocol Buffers (Protobuf v3)** và **gRPC**.*
> 
> *Nhờ có file `.proto` độc lập này, sau này nếu nhóm muốn viết lại `inventory-service` bằng ngôn ngữ **Go/Rust/Java** để tối ưu tốc độ thì `booking-service` và `api-gateway` viết bằng TypeScript vẫn có thể giao tiếp bình thường mà không cần sửa đổi bất kỳ dòng code nào. Giao diện IDL chuẩn hoá đã tách rời hoàn toàn phần định nghĩa nghiệp vụ khỏi công nghệ triển khai."*

---

## 3️⃣ ĐẶC TRƯNG 3: CONCURRENCY CONTROL (KIỂM SOÁT ĐỒNG THỜI - CHỐNG BÁN TRÙNG GHẾ)

### 📌 Mục tiêu:
Kiểm tra khả năng giải quyết xung đột khi nhiều khách hàng cùng tranh giành chiếc vé cuối cùng (Race Condition). Hệ thống hỗ trợ 2 chiến lược: **Pessimistic Locking** và **Optimistic Locking**.

### 🖥️ Lệnh chạy kịch bản:
```bash
node demo/demo-concurrency.js
```

### 📊 Kết quả quan sát:
- 10 requests được bắn đi **hoàn toàn đồng thời** qua `Promise.all()`.
- **Đúng 1 request** nhận mã `HTTP 201 Created` (Đặt vé thành công).
- **9 requests còn lại** nhận mã `HTTP 409 Conflict` kèm thông báo: `Seat A20 is already booked`.
- Không xảy ra hiện tượng bán trùng vé (Double Booking).

### ⚙️ Demo so sánh 2 chiến lược khoá:
1. **Pessimistic Locking (Mặc định)**:
   - Dùng `SELECT ... FOR UPDATE` trong transaction của PostgreSQL.
   - Transaction đầu tiên giữ khoá độc quyền (Exclusive Lock), các transaction đến sau phải chờ cho đến khi transaction trước hoàn tất và lập tức nhận kết quả ghế đã bị giữ.
2. **Optimistic Locking**:
   Chuyển chiến lược sang Optimistic bằng cách chạy:
   ```bash
   LOCK_STRATEGY=optimistic docker compose up -d inventory-service
   node demo/demo-concurrency.js
   ```
   - Đọc phiên bản ghế (`version: 1`).
   - Cập nhật nguyên tử: `UPDATE seats SET status='booked', version=version+1 WHERE id='20' AND version=1`.
   - Request nhanh chân nhất đẩy version lên `2`. Các request còn lại có số bản ghi bị ảnh hưởng `affected = 0`, hệ thống phát hiện xung đột và ném ra lỗi `Optimistic Lock Conflict`.

### 🎤 Lời thoại thuyết minh trước Giám khảo:
> *"Trong một hệ thống bán vé xem phim hay vé máy bay, bài toán sinh tử là **Concurrency Control - Chống bán trùng ghế**. Tại đây, hệ thống của nhóm đã cài đặt cả 2 giải pháp:*
> - *Với **Pessimistic Locking**: Chúng em sử dụng cơ chế `SELECT FOR UPDATE` của hệ quản trị cơ sở dữ liệu để bảo đảm an toàn tuyệt đối khi tỷ lệ tranh chấp cực cao.*
> - *Với **Optimistic Locking**: Chúng em sử dụng cột `version`. Mỗi lần sửa đổi dữ liệu sẽ tăng version lên 1 đơn vị. Nếu nhiều request cùng đọc version 1 thì chỉ 1 request ghi đè thành công lên version 2, các request còn lại bị từ chối ngay lập tức mà không cần treo khoá cơ sở dữ liệu.*
> 
> *Kết quả thực nghiệm cho thấy đúng 1 người đặt được vé và 9 người còn lại nhận mã lỗi 409 Conflict, bảo đảm tính nhất quán dữ liệu nghiêm ngặt (Strict Consistency)."*

---

## 4️⃣ ĐẶC TRƯNG 4: SCALABILITY (KHẢ NĂNG MỞ RỘNG NGANG QUA LOAD BALANCING)

### 📌 Mục tiêu:
Chứng minh hệ thống có thể mở rộng quy mô (Scale-out) dễ dàng bằng cách tăng thêm số lượng container của `booking-service` và sử dụng **Nginx làm gRPC Load Balancer**.

### 🖥️ Lệnh chạy kịch bản:
```bash
./demo/demo-scale.sh
```

### 📊 Kết quả quan sát:
1. Lệnh `docker compose up --scale booking-service=3 -d` khởi chạy thêm 2 instance của booking-service.
2. Bắn 30 request liên tiếp vào hệ thống.
3. Bảng thống kê hiển thị:
   - Container 1 xử lý: ~10 requests
   - Container 2 xử lý: ~10 requests
   - Container 3 xử lý: ~10 requests

### 🎤 Lời thoại thuyết minh trước Giám khảo:
> *"Đặc trưng thứ tư là **Scalability (Khả năng mở rộng)**. Khi mở bán các suất chiếu bom tấn, lượng truy cập có thể tăng gấp 10 lần. Nhờ thiết kế theo kiến trúc phi trạng thái (Stateless Service), chúng em chỉ cần ra lệnh mở rộng `booking-service` từ 1 lên 3 container mà không cần chỉnh sửa code hay khởi động lại toàn bộ hệ thống.*
> 
> *Nginx đóng vai trò là gRPC Load Balancer, tự động phân giải DNS của Docker và điều phối các request lần lượt theo thuật toán Round-Robin. Kết quả bảng thống kê cho thấy tải được san đều qua cả 3 container (Container ID hiển thị rõ ràng trên từng phản hồi)."*

---

## 5️⃣ ĐẶC TRƯNG 5: FAULT TOLERANCE & ASYNCHRONOUS DECOUPLING (CHỊU LỖI & KHỚP NỐI LỎNG)

### 📌 Mục tiêu:
Chứng minh **Partial Failure (Lỗi từng phần)** và tính bền vững của hàng đợi tin nhắn: Nếu một dịch vụ phụ trợ như `notification-service` bị sập, dịch vụ cốt lõi (đặt vé) vẫn vận hành bình thường, và tin nhắn không bao giờ bị mất nhờ **RabbitMQ Durable Queue**.

### 🖥️ Lệnh chạy kịch bản:
```bash
./demo/demo-fault-tolerance.sh
```

### 📊 Trình tự diễn ra trên terminal:
1. Cố tình tắt hẳn `notification-service` bằng `docker stop notification-service`.
2. Gửi request đặt vé: Hệ thống **vẫn trả về HTTP 201 Created** (Vé vẫn được xuất thành công!).
3. Khởi động lại `notification-service` bằng `docker start notification-service`.
4. Xem log của notification-service: Worker vừa online đã lập tức tiêu thụ (consume) tin nhắn đang chờ trong RabbitMQ và giả lập gửi email vé ngay lập tức!

### 🎤 Lời thoại thuyết minh trước Giám khảo:
> *"Thưa Thầy/Cô, trong môi trường phân tán, một chân lý quan trọng là: **'Lỗi mạng và lỗi máy chủ là điều tất yếu sẽ xảy ra'**. Để chống hiện tượng sập dây chuyền (Cascading Failure), nhóm em áp dụng mô hình **Khớp nối lỏng bất đồng bộ (Asynchronous Decoupling)**.*
> 
> *Booking-service không gọi trực tiếp notification-service mà chỉ đẩy một event `booking.confirmed` vào RabbitMQ. Khi notification-service bị sự cố tắt ngóm, luồng đặt vé của khách hàng vẫn hoàn thành 100%. Khi dịch vụ thông báo được bật lại, cơ chế **Durable Queue** và **Manual Acknowledgment** của RabbitMQ đảm bảo thông điệp cũ được lấy ra xử lý bù mà không bị thất thoát một chiếc vé nào."*

---

## 6️⃣ ĐẶC TRƯNG 6: NO GLOBAL CLOCK (KHÔNG CÓ ĐỒNG HỒ TOÀN CỤC)

### 📌 Mục tiêu:
Chứng minh trong hệ thống phân tán, không tồn tại một đồng hồ vật lý toàn cục duy nhất. Mỗi máy tính/container có local clock riêng và luôn có độ lệch thời gian do Network Delay và Clock Drift.

### 🖥️ Lệnh chạy kịch bản:
```bash
./demo/demo-no-global-clock.sh
```

### 📊 Kết quả quan sát:
Terminal trích xuất log của 3 service cho cùng 1 thao tác đặt vé:
- `api-gateway`: Log timestamp lúc `15:42:01.120Z`
- `booking-service`: Log timestamp lúc `15:42:01.125Z` (+5ms)
- `inventory-service`: Log timestamp lúc `15:42:01.129Z` (+4ms)
- `notification-service`: Log timestamp lúc `15:42:01.145Z` (+16ms)

### 🎤 Lời thoại thuyết minh trước Giám khảo:
> *"Đặc trưng thứ 6 là một bài học kinh điển của môn học: **No Global Clock (Không có đồng hồ toàn cục)**. Mỗi container đều sở hữu bộ đếm thời gian riêng.*
> 
> *Dù cùng chạy trên một máy tính vật lý, các timestamp ghi nhận trong log vẫn lệch nhau vài mili-giây do độ trễ truyền gói tin qua mạng Docker và chu kỳ chuyển đổi tác vụ của CPU. Nếu triển khai trên các Cloud Server ở các châu lục khác nhau, độ lệch này sẽ còn lớn hơn nhiều.*
> 
> *Vì vậy, một hệ thống phân tán chuẩn mực **không bao giờ dùng đồng hồ vật lý để phân định ai nhanh hơn ai**. Thay vào đó, chúng em giải quyết bằng **Thứ tự quan hệ nhân quả (Causality)** và **Cơ chế đồng thuận/khoá giao dịch cấp Database (Serialization)**."*

---

## 🏁 PHẦN KẾT LUẬN & HỎI ĐÁP (Q&A)

### 🎤 Lời kết:
> *"Kính thưa Thầy/Cô, thông qua đề tài **Hệ thống đặt vé xem phim phân tán**, nhóm em đã chứng minh được trọn vẹn các đặc tính then chốt của Hệ thống phân tán:*
> 1. *Tính trong suốt (Transparency)*
> 2. *Tính mở (Openness qua gRPC Protobuf)*
> 3. *Kiểm soát đồng thời (Concurrency Control qua 2 cơ chế khoá)*
> 4. *Khả năng mở rộng (Scalability qua Nginx Load Balancer)*
> 5. *Khả năng chịu lỗi và khớp nối lỏng (Fault Tolerance qua RabbitMQ)*
> 6. *Hiện tượng không có đồng hồ toàn cục (No Global Clock)*
> 
> *Em xin chân thành cảm ơn Thầy/Cô đã chú ý lắng nghe. Nhóm em rất mong nhận được những câu hỏi và đóng góp ý kiến từ Thầy/Cô ạ!"*

---

## 💡 CÁC CÂU HỎI HỘI ĐỒNG THƯỜNG HỎI & CÁCH TRẢ LỜI

**Câu 1: Tại sao lại dùng gRPC giữa Gateway và Booking mà không dùng REST thông thường?**
> *Trả lời:* gRPC hoạt động trên giao thức HTTP/2, dữ liệu được tuần tự hoá dưới dạng nhị phân (Protocol Buffers) thay vì chuỗi JSON, giúp giảm kích thước gói tin đến 60-80% và hỗ trợ multiplexing. Do đó độ trễ (latency) của gRPC thấp hơn đáng kể so với REST, rất phù hợp cho giao tiếp nội bộ giữa các microservices.

**Câu 2: Khi nào nên dùng Pessimistic Lock, khi nào nên dùng Optimistic Lock?**
> *Trả lời:* 
> - **Pessimistic Lock** phù hợp khi xác suất tranh chấp dữ liệu rất cao (ví dụ: mở bán vé concert BlackPink hoặc ghế VIP rạp phim), việc giữ khoá ngay lập tức ngăn chặn các transaction khác làm việc thừa thãi.
> - **Optimistic Lock** phù hợp khi số lượng đọc nhiều hơn ghi và xác suất tranh chấp thấp (ví dụ: cập nhật hồ sơ người dùng, duyệt hàng tồn kho thông thường), giúp hệ thống không phải chịu chi phí lock tài nguyên DB.

**Câu 3: Làm sao đảm bảo Database per Service không vi phạm tính toàn vẹn dữ liệu?**
> *Trả lời:* Trong kiến trúc Database-per-service, ta không thể dùng Foreign Key giữa 2 database riêng biệt. Thay vào đó, tính toàn vẹn được duy trì thông qua các giao tác phân tán (Distributed Transactions), mô hình Saga (Choreography/Orchestration) hoặc sử dụng các thông điệp bất đồng bộ để đạt tới trạng thái **Eventual Consistency (Nhất quán sau cùng)**.
