#!/usr/bin/env node

/**
 * ==============================================================================
 * DEMO 2: CONCURRENCY CONTROL (Kiểm soát đồng thời & Chống bán trùng ghế)
 * ==============================================================================
 * BẮN ĐỒNG THỜI 10 REQUEST ĐẶT CÙNG 1 GHẾ DUY NHẤT (Ghế A20, seatId="20").
 * 
 * KẾT QUẢ KỲ VỌNG THEO CHUẨN HỆ THỐNG PHÂN TÁN:
 * - ĐÚNG 1 request thành công (HTTP 201 Created)
 * - 9 request còn lại BỊ TỪ CHỐI (HTTP 409 Conflict)
 * - Tuyệt đối KHÔNG xảy ra hiện tượng Double Booking (bán trùng vé).
 * 
 * CƠ CHẾ KHOÁ ĐƯỢC KIỂM CHỨNG:
 * 1. Pessimistic Locking (SELECT ... FOR UPDATE)
 * 2. Optimistic Locking (So khớp Version Column)
 * ==============================================================================
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const NUM_REQUESTS = 10;

async function resetDemoData() {
  console.log(`🔄 [1/3] Đang gọi API Reset hệ thống về trạng thái ban đầu (Ghế A20 available)...`);
  try {
    const res = await fetch(`${GATEWAY_URL}/dev/reset`, { method: 'POST' });
    const data = await res.json();
    console.log(`✅ Reset thành công: ${data.message || 'OK'}\n`);
  } catch (err) {
    console.error(`❌ Không thể kết nối tới Gateway tại ${GATEWAY_URL}: ${err.message}`);
    process.exit(1);
  }
}

async function checkCurrentSeatState() {
  console.log(`🔍 [2/3] Kiểm tra trạng thái ghế A20 trước khi bắn tải:`);
  try {
    const res = await fetch(`${GATEWAY_URL}/movies/1`);
    const data = await res.json();
    const seat20 = data.seats.find(s => s.id === '20');
    console.log(`   • Suất chiếu : ${data.showtime.movieName} (${data.showtime.room})`);
    console.log(`   • Ghế A20    : ID=${seat20.id}, Trạng thái=${seat20.status.toUpperCase()}, Version=${seat20.version}\n`);
  } catch (err) {
    console.warn(`   ⚠️ Không thể đọc trạng thái ghế: ${err.message}\n`);
  }
}

async function sendBookingRequest(index) {
  const userName = `Customer_${index + 1}`;
  const startTime = Date.now();

  try {
    const res = await fetch(`${GATEWAY_URL}/booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showtimeId: '1',
        seatId: '20',
        userName: userName,
      }),
    });

    const elapsed = Date.now() - startTime;
    const body = await res.json();

    return {
      index: index + 1,
      userName,
      status: res.status,
      elapsed,
      success: res.status === 201,
      body,
    };
  } catch (err) {
    return {
      index: index + 1,
      userName,
      status: 0,
      elapsed: Date.now() - startTime,
      success: false,
      error: err.message,
    };
  }
}

async function main() {
  console.log('================================================================================');
  console.log('⚡ DEMO CONCURRENCY CONTROL: BẮN ĐỒNG THỜI 10 REQUEST ĐẶT CÙNG GHẾ A20');
  console.log('================================================================================\n');

  await resetDemoData();
  await checkCurrentSeatState();

  console.log(`🚀 [3/3] Đang phát đồng thời ${NUM_REQUESTS} requests qua Promise.all()...\n`);
  const totalStartTime = Date.now();

  const requests = Array.from({ length: NUM_REQUESTS }, (_, i) => sendBookingRequest(i));
  const results = await Promise.all(requests);

  const totalTime = Date.now() - totalStartTime;

  console.log('--------------------------------------------------------------------------------');
  console.log('CHI TIẾT KẾT QUẢ TỪNG REQUEST:');
  console.log('--------------------------------------------------------------------------------');

  let successCount = 0;
  let conflictCount = 0;
  let otherErrorCount = 0;
  let winner = null;

  results.forEach(r => {
    const symbol = r.success ? '✅ [THÀNH CÔNG]' : (r.status === 409 ? '❌ [TỪ CHỐI]' : '⚠️ [LỖI KHÁC]');
    const latency = `${r.elapsed}ms`.padStart(6, ' ');

    if (r.success) {
      successCount++;
      winner = r;
      console.log(`${symbol} Req #${r.index} (${r.userName}) -> HTTP ${r.status} (${latency}) | Booking ID: ${r.body.bookingId} | Node: ${r.body.processedByHost}`);
    } else if (r.status === 409) {
      conflictCount++;
      console.log(`${symbol} Req #${r.index} (${r.userName}) -> HTTP ${r.status} (${latency}) | ${r.body.message}`);
    } else {
      otherErrorCount++;
      console.log(`${symbol} Req #${r.index} (${r.userName}) -> HTTP ${r.status} (${latency}) | Error: ${r.error || JSON.stringify(r.body)}`);
    }
  });

  console.log('--------------------------------------------------------------------------------');
  console.log('📊 TỔNG KẾT THỐNG KÊ CONCURRENCY CONTROL:');
  console.log('--------------------------------------------------------------------------------');
  console.log(`   • Tổng số request gửi đi      : ${NUM_REQUESTS}`);
  console.log(`   • Thành công (HTTP 201)       : ${successCount} (Chỉ duy nhất 1 khách đặt được ghế)`);
  console.log(`   • Bị từ chối do hết ghế (409) : ${conflictCount}`);
  console.log(`   • Lỗi mạng / Lỗi khác         : ${otherErrorCount}`);
  console.log(`   • Tổng thời gian xử lý        : ${totalTime}ms`);
  if (winner) {
    console.log(`   🏆 Khách hàng may mắn         : ${winner.userName} (Mã đặt vé: ${winner.body.bookingId})`);
  }
  console.log('================================================================================');

  if (successCount === 1 && conflictCount === (NUM_REQUESTS - 1)) {
    console.log('🎉 KẾT QUẢ HOÀN TOÀN CHÍNH XÁC: Hệ thống bảo toàn tính nhất quán (Strict Consistency)!');
    console.log('   Không hề xảy ra hiện tượng Double Booking trong môi trường phân tán.');
  } else {
    console.warn('⚠️ KẾT QUẢ BẤT THƯỜNG: Vui lòng kiểm tra lại cấu hình khoá dữ liệu.');
  }
  console.log('================================================================================\n');
}

main();
