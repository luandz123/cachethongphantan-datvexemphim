import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientGrpc, ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { Booking } from './entities/booking.entity';

interface InventoryGrpcService {
  reserveSeat(data: { seatId: string; showtimeId: string; userName: string }): Observable<any>;
  resetData(data: any): Observable<any>;
}

@Injectable()
export class BookingService implements OnModuleInit {
  private readonly logger = new Logger('BookingService');
  private readonly hostname = os.hostname();
  private inventoryGrpc: InventoryGrpcService;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @Inject('INVENTORY_PACKAGE')
    private readonly clientGrpc: ClientGrpc,
    @Inject('RABBITMQ_CLIENT')
    private readonly rabbitClient: ClientProxy,
  ) {}

  onModuleInit() {
    this.inventoryGrpc = this.clientGrpc.getService<InventoryGrpcService>('InventoryService');
    this.logInfo(`Booking Service initialized on host ${this.hostname}. Connected to Inventory gRPC.`);
  }

  private logInfo(message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[BOOKING-SERVICE] [HOST: ${this.hostname}] [TIME: ${timestamp}] ${message}`);
  }

  private logWarn(message: string) {
    const timestamp = new Date().toISOString();
    console.warn(`[BOOKING-SERVICE] [HOST: ${this.hostname}] [TIME: ${timestamp}] ⚠️ ${message}`);
  }

  private logError(message: string) {
    const timestamp = new Date().toISOString();
    console.error(`[BOOKING-SERVICE] [HOST: ${this.hostname}] [TIME: ${timestamp}] ❌ ${message}`);
  }

  async createBooking(showtimeId: string, seatId: string, userName: string) {
    this.logInfo(`Received booking request: showtimeId=${showtimeId}, seatId=${seatId}, user="${userName}"`);

    // Step 1: Call Inventory Service via gRPC to reserve seat
    let reserveRes: any;
    try {
      this.logInfo(`Calling InventoryService.ReserveSeat via gRPC for seatId=${seatId}...`);
      reserveRes = await firstValueFrom(
        this.inventoryGrpc.reserveSeat({ seatId, showtimeId, userName }),
      );
      this.logInfo(`Inventory gRPC returned success: seatCode=${reserveRes.seatCode}, movieName=${reserveRes.movieName}`);
    } catch (err) {
      this.logWarn(`InventoryService rejected seat reservation: ${err.message || err.details}`);
      throw new RpcException({
        code: err.code || 2, // UNKNOWN or pass through
        message: err.message || err.details || 'Failed to reserve seat in inventory',
      });
    }

    // Step 2: Save Booking record into PostgreSQL booking_db
    const booking = this.bookingRepo.create({
      id: uuidv4(),
      seatId,
      showtimeId,
      userName,
      status: 'CONFIRMED',
    });
    await this.bookingRepo.save(booking);
    this.logInfo(`Saved booking to booking_db: bookingId=${booking.id}`);

    // Step 3: Publish event to RabbitMQ (Asynchronous Decoupling)
    const eventPayload = {
      bookingId: booking.id,
      seatId,
      seatCode: reserveRes.seatCode,
      movieName: reserveRes.movieName,
      showtimeId,
      userName,
      status: 'CONFIRMED',
      createdAt: booking.createdAt ? booking.createdAt.toISOString() : new Date().toISOString(),
      processedByHost: this.hostname,
      timestamp: new Date().toISOString(),
    };

    try {
      this.logInfo(`Publishing "booking.confirmed" event to RabbitMQ for bookingId=${booking.id}...`);
      // Emit event (fire and forget / async decouple)
      this.rabbitClient.emit('booking.confirmed', eventPayload);
      this.logInfo(`Published "booking.confirmed" successfully to RabbitMQ`);
    } catch (err) {
      this.logError(`Failed to publish message to RabbitMQ: ${err.message}`);
      // Even if RabbitMQ is temporarily down, the booking is confirmed in DB
    }

    return {
      success: true,
      bookingId: booking.id,
      seatId,
      seatCode: reserveRes.seatCode,
      movieName: reserveRes.movieName,
      showtimeId,
      userName,
      status: 'CONFIRMED',
      createdAt: booking.createdAt ? booking.createdAt.toISOString() : new Date().toISOString(),
      processedByHost: this.hostname,
      timestamp: new Date().toISOString(),
    };
  }

  async getBooking(bookingId: string) {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
    if (!booking) {
      throw new RpcException({
        code: 5, // NOT_FOUND
        message: `Booking with ID ${bookingId} not found`,
      });
    }
    return {
      id: booking.id,
      seatId: booking.seatId,
      showtimeId: booking.showtimeId,
      userName: booking.userName,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
      processedByHost: this.hostname,
    };
  }

  async resetData() {
    this.logInfo('Resetting booking records in booking_db...');
    await this.bookingRepo.clear();
    this.logInfo('All booking records deleted.');
    return { success: true, message: 'Booking data reset successfully' };
  }
}
