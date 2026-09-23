#!/bin/bash
# ==============================================================================
# DEMO 1: TRANSPARENCY (Tính Trong Suốt trong Hệ Thống Phân Tán)
# ==============================================================================
# GIẢI THÍCH LÝ THUYẾT:
# - Access Transparency & Location Transparency: Client chỉ tương tác với 1 điểm 
#   đầu cuối duy nhất (API Gateway tại http://localhost:3000/booking).
# - Client KHÔNG hề biết và KHÔNG cần quan tâm:
#   1. Phía sau gồm bao nhiêu microservices (booking, inventory, notification).
#   2. Địa chỉ IP nội bộ hay ngôn ngữ/framework của từng service.
#   3. Giao thức nội bộ là gì (gRPC trên HTTP/2, AMQP trên RabbitMQ).
#   4. Dữ liệu được phân tán trên mấy Database (Database-per-service: inventory_db, booking_db).
# ==============================================================================

set -e

GATEWAY_URL="http://localhost:3000"

echo "================================================================================"
echo "🎯 BƯỚC 1: RESET DỮ LIỆU ĐỂ ĐẢM BẢO GHẾ A20 SẴN SÀNG"
echo "================================================================================"
curl -s -X POST "$GATEWAY_URL/dev/reset" | jq . || curl -s -X POST "$GATEWAY_URL/dev/reset"
echo -e "\n"

echo "================================================================================"
echo "🎯 BƯỚC 2: CLIENT GỬI 1 REQUEST ĐẶT VÉ DUY NHẤT TỚI API GATEWAY"
echo "   Endpoint: POST $GATEWAY_URL/booking"
echo "   Payload : { showtimeId: '1', seatId: '20', userName: 'NguyenVanA' }"
echo "================================================================================"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$GATEWAY_URL/booking" \
  -H "Content-Type: application/json" \
  -d '{
    "showtimeId": "1",
    "seatId": "20",
    "userName": "NguyenVanA"
  }')

BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "--------------------------------------------------------------------------------"
echo "PHẢN HỒI TỪ API GATEWAY (HTTP STATUS: $STATUS):"
if command -v jq &> /dev/null; then
  echo "$BODY" | jq .
else
  echo "$BODY"
fi
echo "--------------------------------------------------------------------------------"

echo -e "\n💡 NHẬN XÉT ĐẶC TRƯNG TRANSPARENCY:"
echo "1. Client chỉ gọi duy nhất 1 REST API nhưng thực tế hệ thống đã âm thầm thực hiện:"
echo "   - API Gateway nhận HTTP POST, gọi gRPC ReserveSeat sang Inventory Service."
echo "   - Inventory Service khoá dữ liệu và cập nhật inventory_db."
echo "   - Booking Service tạo mã vé và lưu vào booking_db."
echo "   - Booking Service phát tán event 'booking.confirmed' vào RabbitMQ."
echo "   - Notification Service nhận message và giả lập gửi email."
echo "2. Mọi sự phức tạp về mạng phân tán hoàn toàn 'trong suốt' (ẩn giấu) đối với Client!"
echo "================================================================================"
