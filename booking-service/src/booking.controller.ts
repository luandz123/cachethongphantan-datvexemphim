import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import * as os from 'os';
import { BookingService } from './booking.service';

@Controller()
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'booking-service',
      hostname: os.hostname(),
      timestamp: new Date().toISOString(),
    };
  }

  @GrpcMethod('BookingService', 'CreateBooking')
  async createBooking(data: { showtimeId: string; seatId: string; userName: string }) {
    return this.bookingService.createBooking(data.showtimeId, data.seatId, data.userName);
  }

  @GrpcMethod('BookingService', 'GetBooking')
  async getBooking(data: { bookingId: string }) {
    return this.bookingService.getBooking(data.bookingId);
  }

  @GrpcMethod('BookingService', 'ResetData')
  async resetData() {
    return this.bookingService.resetData();
  }
}
