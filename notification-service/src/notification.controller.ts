import { Controller } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import * as os from 'os';

@Controller()
export class NotificationController {
  private readonly hostname = os.hostname();

  @EventPattern('booking.confirmed')
  async handleBookingConfirmed(@Payload() data: any, @Ctx() context: RmqContext) {
    const receivedTime = new Date().toISOString();
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    console.log(`\n================================================================================`);
    console.log(`[NOTIFICATION-SERVICE] [HOST: ${this.hostname}] [TIME: ${receivedTime}]`);
    console.log(`📩 [ASYNC EVENT RECEIVED] Event: "booking.confirmed" from RabbitMQ`);
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`🎟️  SIMULATING EMAIL DISPATCH:`);
    console.log(`   • To Customer     : ${data.userName}`);
    console.log(`   • Booking ID      : ${data.bookingId}`);
    console.log(`   • Movie           : ${data.movieName}`);
    console.log(`   • Showtime ID     : ${data.showtimeId}`);
    console.log(`   • Seat Code       : ${data.seatCode} (ID: ${data.seatId})`);
    console.log(`   • Status          : ${data.status}`);
    console.log(`   • Booking Created : ${data.createdAt}`);
    console.log(`   • Source Node     : ${data.processedByHost}`);
    console.log(`   • Notification At : ${receivedTime}`);
    console.log(`✅ Email successfully queued & sent to ${data.userName} for Seat ${data.seatCode}!`);
    console.log(`================================================================================\n`);

    // Acknowledge message
    try {
      channel.ack(originalMsg);
    } catch (e) {
      // Channel may already auto-ack if noAck: true
    }
  }
}
