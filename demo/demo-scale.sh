#!/bin/bash
# ==============================================================================
# DEMO 3: SCALABILITY & LOAD BALANCING (Khả năng Mở rộng Ngang & Cân bằng Tải)
# ==============================================================================
# GIẢI THÍCH LÝ THUYẾT:
# - Horizontal Scaling (Scale-out): Tăng năng lực chịu tải của hệ thống bằng cách
#   nhân bản thêm các instance của service (ở đây là booking-service) mà không cần
#   thay đổi kiến trúc code.
# - Nginx đóng vai trò Load Balancer (Reverse Proxy gRPC), tự động phát hiện
#   các container mới và điều phối tải theo thuật toán Round-Robin.
# ==============================================================================

set -e

GATEWAY_URL="http://localhost:3000"

echo "================================================================================"
echo "🎯 BƯỚC 1: SCALE OUT BOOKING-SERVICE THÀNH 3 CONTAINERS"
echo "   Lệnh: docker compose up --scale booking-service=3 -d"
echo "================================================================================"

docker compose up --scale booking-service=3 -d

echo -e "\n⏳ Đang đợi các container khởi động và ổn định trong 8 giây..."
sleep 8

echo -e "\nDanh sách các container booking-service đang hoạt động:"
docker compose ps | grep booking-service || true

echo -e "\n================================================================================"
echo "🎯 BƯỚC 2: BẮN 30 REQUEST LIÊN TIẾP ĐẾN API GATEWAY"
echo "   (Hệ thống sẽ reset data liên tục để request luôn thành công và ghi nhận host xử lý)"
echo "================================================================================"

HOST_COUNTS_FILE=$(mktemp)

for i in $(seq 1 30); do
  # Reset nhanh ghế A20 để booking luôn thành công
  curl -s -X POST "$GATEWAY_URL/dev/reset" > /dev/null

  # Gửi request đặt vé
  RESPONSE=$(curl -s -X POST "$GATEWAY_URL/booking" \
    -H "Content-Type: application/json" \
    -d "{\"showtimeId\": \"1\", \"seatId\": \"20\", \"userName\": \"LoadTestUser_$i\"}")

  # Trích xuất hostname xử lý từ response
  HOST=$(echo "$RESPONSE" | grep -o '"processedByHost":"[^"]*' | cut -d'"' -f4 || echo "unknown")
  BOOKING_ID=$(echo "$RESPONSE" | grep -o '"bookingId":"[^"]*' | cut -d'"' -f4 || echo "N/A")

  echo "Request #$i -> Xử lý bởi Booking Node Container: [$HOST] (BookingID: $BOOKING_ID)"
  echo "$HOST" >> "$HOST_COUNTS_FILE"
done

echo -e "\n================================================================================"
echo "📊 BƯỚC 3: THỐNG KÊ PHÂN PHỐI TẢI GIỮA CÁC CONTAINER BOOKING-SERVICE"
echo "================================================================================"
echo "Số lượng request được chia đều qua các container ID/Hostname:"
sort "$HOST_COUNTS_FILE" | uniq -c | while read count host; do
  echo "   🔹 Container [$host] đã xử lý: $count / 30 requests"
done

rm -f "$HOST_COUNTS_FILE"

echo -e "\n💡 NHẬN XÉT ĐẶC TRƯNG SCALABILITY:"
echo "1. Cả 3 instance của booking-service đều tham gia xử lý tải xấp xỉ ngang nhau."
echo "2. Client chỉ tương tác với 1 Gateway duy nhất, Nginx gRPC Proxy chịu trách nhiệm điều phối tải."
echo "3. Hệ thống dễ dàng scale lên 5, 10 container khi lượng người dùng tăng đột biến trong các dịp mở bán vé bom tấn!"
echo "================================================================================"
