#!/bin/bash
# ==============================================================================
# DEMO 5: NO GLOBAL CLOCK (Không có Đồng Hồ Toàn Cục trong Hệ Thống Phân Tán)
# ==============================================================================
# GIẢI THÍCH LÝ THUYẾT:
# - Trong một hệ thống phân tán, các nút mạng (nodes) hoạt động độc lập trên các
#   phần cứng hoặc container riêng biệt.
# - Không tồn tại một 'Đồng hồ toàn cục' (No Global Physical Clock) có thể đo đếm
#   thời gian tuyệt đối tức thời cho mọi nút do:
#   1. Clock Drift (Độ lệch thạch anh của từng máy tính).
#   2. Network Latency & Jitter (Độ trễ truyền tin trên cáp quang/mạng là không cố định).
# - Thứ tự các sự kiện trong hệ thống phân tán phải dựa trên quan hệ nhân quả (Causality)
#   như Lamport Timestamps hoặc Vector Clocks thay vì đồng hồ vật lý.
# ==============================================================================

set -e

GATEWAY_URL="http://localhost:3000"

echo "================================================================================"
echo "🎯 BƯỚC 1: RESET VÀ GỬI 1 REQUEST ĐẶT VÉ MẪU"
echo "================================================================================"

curl -s -X POST "$GATEWAY_URL/dev/reset" > /dev/null

BOOKING_RES=$(curl -s -X POST "$GATEWAY_URL/booking" \
  -H "Content-Type: application/json" \
  -d '{
    "showtimeId": "1",
    "seatId": "20",
    "userName": "ClockDemoUser"
  }')

echo "Kết quả đặt vé:"
if command -v jq &> /dev/null; then
  echo "$BOOKING_RES" | jq .
else
  echo "$BOOKING_RES"
fi

echo -e "\n================================================================================"
echo "🎯 BƯỚC 2: TRÍCH XUẤT VÀ SO SÁNH TIMESTAMP LOGS GIỮA CÁC SERVICE"
echo "================================================================================"

echo -e "\n--- LOG TỪ API GATEWAY ---"
docker compose logs --tail=4 api-gateway | grep "Forwarding booking" || docker compose logs --tail=4 api-gateway

echo -e "\n--- LOG TỪ BOOKING-SERVICE ---"
docker compose logs --tail=6 booking-service | grep -E "Received booking request|Calling InventoryService" || docker compose logs --tail=6 booking-service

echo -e "\n--- LOG TỪ INVENTORY-SERVICE ---"
docker compose logs --tail=6 inventory-service | grep -E "Reserve request for seatId|Pessimistic|Optimistic" || docker compose logs --tail=6 inventory-service

echo -e "\n--- LOG TỪ NOTIFICATION-SERVICE ---"
docker compose logs --tail=8 notification-service | grep -E "ASYNC EVENT RECEIVED|Notification At" || docker compose logs --tail=8 notification-service

echo -e "\n================================================================================"
echo "💡 PHÂN TÍCH HIỆN TƯỢNG 'NO GLOBAL CLOCK' ĐỂ BẢO VỆ ĐỒ ÁN:"
echo "--------------------------------------------------------------------------------"
echo "1. Quan sát thời gian log (Timestamp ISO với độ phân giải mili-giây):"
echo "   - API Gateway nhận request và ghi log tại T_gateway."
echo "   - Booking-service ghi log tại T_booking."
echo "   - Inventory-service nhận gRPC và ghi log tại T_inventory."
echo "   - Notification-service nhận RabbitMQ event và ghi log tại T_notification."
echo "2. Sự khác biệt (Offset/Delay):"
echo "   - Dù cùng chạy trên 1 máy tính qua Docker, các process/container vẫn có thời gian"
echo "     đo lường lệch nhau vài ms do độ trễ truyền gói tin mạng (Network transmission delay)"
echo "     và thời điểm context switch của CPU."
echo "   - Nếu deploy thật trên 3 server ở 3 quốc gia (AWS us-east, ap-southeast, eu-west):"
echo "     Sai số NTP (Network Time Protocol) có thể lên tới 10ms - 100ms!"
echo "3. Kết luận lý thuyết:"
echo "   - Hệ thống không thể tin cậy vào timestamp tuyệt đối để quyết định ai đến trước ai."
echo "   - Thay vào đó, ta sử dụng cơ chế Concurrency Control (Database Locking, Atomic Transactions)"
echo "     để phân định thứ tự chính xác (Linearizability / Serialization)!"
echo "================================================================================"
