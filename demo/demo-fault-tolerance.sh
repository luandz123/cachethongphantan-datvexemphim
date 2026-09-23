#!/bin/bash
# ==============================================================================
# DEMO 4: FAULT TOLERANCE & ASYNCHRONOUS DECOUPLING
# (Khả năng chịu lỗi thành phần & Khớp nối lỏng bất đồng bộ)
# ==============================================================================
# GIẢI THÍCH LÝ THUYẾT:
# - Partial Failure (Lỗi từng phần): Một thành phần gặp sự cố không được phép kéo sập
#   toàn bộ hệ sinh thái (no cascading failure).
# - Asynchronous Decoupling qua Message Broker: Booking Service và Notification Service
#   giao tiếp gián tiếp qua RabbitMQ. Khi Notification Service bị down, tin nhắn
#   vẫn được lưu trữ an toàn trong Queue bền vững (Durable Queue).
# - Eventual Consistency: Khi Notification Service phục hồi, nó tiếp tục xử lý
#   các message tồn đọng mà không làm mất dữ liệu của khách hàng.
# ==============================================================================

set -e

GATEWAY_URL="http://localhost:3000"

echo "================================================================================"
echo "🎯 BƯỚC 1: CỐ TÌNH ĐÁNH SẬP NOTIFICATION-SERVICE"
echo "   Lệnh: docker stop notification-service"
echo "================================================================================"

docker stop notification-service
echo "✅ Notification-service đã bị DỪNG HOÀN TOÀN (OFFLINE)."

echo -e "\n================================================================================"
echo "🎯 BƯỚC 2: RESET DỮ LIỆU VÀ THỰC HIỆN ĐẶT VÉ TRONG KHI NOTIFICATION-SERVICE ĐANG CHẾT"
echo "================================================================================"

curl -s -X POST "$GATEWAY_URL/dev/reset" > /dev/null

echo "Gửi request đặt vé cho khách hàng: 'Luan_VipUser'..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$GATEWAY_URL/booking" \
  -H "Content-Type: application/json" \
  -d '{
    "showtimeId": "1",
    "seatId": "20",
    "userName": "Luan_VipUser"
  }')

BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "--------------------------------------------------------------------------------"
echo "PHẢN HỒI TỪ HỆ THỐNG (HTTP STATUS: $STATUS):"
if command -v jq &> /dev/null; then
  echo "$BODY" | jq .
else
  echo "$BODY"
fi
echo "--------------------------------------------------------------------------------"

if [ "$STATUS" == "201" ]; then
  echo "🎉 KẾT QUẢ ĐÚNG: Khách hàng vẫn nhận được vé THÀNH CÔNG (HTTP 201)!"
  echo "   Dù notification-service chết, Booking-service và Inventory-service vẫn hoạt động trơn tru."
  echo "   Tin nhắn email vé xem phim đang được giữ an toàn trong RabbitMQ Durable Queue."
else
  echo "❌ Đặt vé thất bại!"
  exit 1
fi

echo -e "\n================================================================================"
echo "🎯 BƯỚC 3: HỒI PHỤC LẠI NOTIFICATION-SERVICE VÀ KIỂM CHỨNG NHẬN MESSAGE BÙ"
echo "   Lệnh: docker start notification-service"
echo "================================================================================"

docker start notification-service
echo "⏳ Đang đợi notification-service khởi động lại trong 5 giây..."
sleep 5

echo -e "\n📋 LOG TỪ NOTIFICATION-SERVICE (Chứng minh xử lý bù message 'booking.confirmed'):"
echo "--------------------------------------------------------------------------------"
docker compose logs --tail=25 notification-service
echo "--------------------------------------------------------------------------------"

echo -e "\n💡 NHẬN XÉT ĐẶC TRƯNG FAULT TOLERANCE & ASYNC DECOUPLING:"
echo "1. Tính độc lập (Loose Coupling): Service này chết không làm nghẽn service kia."
echo "2. Tính kiên cường (Resilience): Tin nhắn đặt vé của khách hàng không bao giờ bị mất."
echo "3. Phục hồi trơn tru (Graceful Recovery): Worker tự động tiêu thụ message ngay khi online trở lại."
echo "================================================================================"
