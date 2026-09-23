import { Injectable, OnModuleInit, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import * as os from 'os';

interface InventoryGrpcService {
  getShowtime(data: { showtimeId: string }): Observable<any>;
  listSeats(data: { showtimeId: string }): Observable<any>;
  resetData(data: any): Observable<any>;
}

interface BookingGrpcService {
  createBooking(data: { showtimeId: string; seatId: string; userName: string }): Observable<any>;
  getBooking(data: { bookingId: string }): Observable<any>;
  resetData(data: any): Observable<any>;
}

@Injectable()
export class GatewayService implements OnModuleInit {
  private inventoryGrpc: InventoryGrpcService;
  private bookingGrpc: BookingGrpcService;
  private readonly hostname = os.hostname();

  constructor(
    @Inject('INVENTORY_PACKAGE') private readonly inventoryClient: ClientGrpc,
    @Inject('BOOKING_PACKAGE') private readonly bookingClient: ClientGrpc,
  ) {}

  onModuleInit() {
    this.inventoryGrpc = this.inventoryClient.getService<InventoryGrpcService>('InventoryService');
    this.bookingGrpc = this.bookingClient.getService<BookingGrpcService>('BookingService');
    console.log(`[API-GATEWAY] [HOST: ${this.hostname}] Connected to Inventory and Booking gRPC services.`);
  }

  private mapGrpcError(err: any): HttpException {
    const timestamp = new Date().toISOString();
    const code = err.code;
    const message = err.details || err.message || 'Internal RPC Error';

    console.warn(`[API-GATEWAY] [HOST: ${this.hostname}] [TIME: ${timestamp}] gRPC Error intercepted: code=${code}, message="${message}"`);

    // 6: ALREADY_EXISTS, 10: ABORTED (used for concurrency lock conflict)
    if (code === 6 || code === 10) {
      return new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message,
          timestamp,
        },
        HttpStatus.CONFLICT,
      );
    }

    // 5: NOT_FOUND
    if (code === 5) {
      return new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message,
          timestamp,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // 3: INVALID_ARGUMENT
    if (code === 3) {
      return new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message,
          timestamp,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 14: UNAVAILABLE
    if (code === 14) {
      return new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          message: `Downstream service unavailable: ${message}`,
          timestamp,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message,
        timestamp,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  async getMovieDetails(showtimeId: string) {
    const timestamp = new Date().toISOString();
    console.log(`[API-GATEWAY] [HOST: ${this.hostname}] [TIME: ${timestamp}] Fetching movie & seat details for showtimeId=${showtimeId}`);

    try {
      const [showtime, seatsRes] = await Promise.all([
        firstValueFrom(this.inventoryGrpc.getShowtime({ showtimeId })),
        firstValueFrom(this.inventoryGrpc.listSeats({ showtimeId })),
      ]);

      return {
        success: true,
        showtime,
        seats: seatsRes.seats,
        gatewayHost: this.hostname,
        timestamp,
      };
    } catch (err) {
      throw this.mapGrpcError(err);
    }
  }

  async bookTicket(showtimeId: string, seatId: string, userName: string) {
    const timestamp = new Date().toISOString();
    console.log(`[API-GATEWAY] [HOST: ${this.hostname}] [TIME: ${timestamp}] Forwarding booking request to BookingService via gRPC: seatId=${seatId}, user="${userName}"`);

    try {
      const result = await firstValueFrom(
        this.bookingGrpc.createBooking({ showtimeId, seatId, userName }),
      );

      return {
        ...result,
        gatewayHost: this.hostname,
      };
    } catch (err) {
      throw this.mapGrpcError(err);
    }
  }

  async getBooking(bookingId: string) {
    try {
      const result = await firstValueFrom(this.bookingGrpc.getBooking({ bookingId }));
      return {
        ...result,
        gatewayHost: this.hostname,
      };
    } catch (err) {
      throw this.mapGrpcError(err);
    }
  }

  async resetAllDemoData() {
    const timestamp = new Date().toISOString();
    console.log(`[API-GATEWAY] [HOST: ${this.hostname}] [TIME: ${timestamp}] Triggering RESET for both Inventory and Booking services...`);

    try {
      const [invReset, bookReset] = await Promise.all([
        firstValueFrom(this.inventoryGrpc.resetData({})),
        firstValueFrom(this.bookingGrpc.resetData({})),
      ]);

      return {
        success: true,
        message: 'All services reset to initial demo state (A20 is available, all bookings cleared)',
        inventory: invReset,
        booking: bookReset,
        timestamp,
      };
    } catch (err) {
      throw this.mapGrpcError(err);
    }
  }
}
