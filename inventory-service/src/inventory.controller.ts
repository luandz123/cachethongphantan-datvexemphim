import { Controller, Get } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'inventory-service',
      lockStrategy: process.env.LOCK_STRATEGY || 'pessimistic',
      timestamp: new Date().toISOString(),
    };
  }

  @GrpcMethod('InventoryService', 'GetShowtime')
  async getShowtime(data: { showtimeId: string }) {
    return this.inventoryService.getShowtime(data.showtimeId);
  }

  @GrpcMethod('InventoryService', 'ListSeats')
  async listSeats(data: { showtimeId: string }) {
    return this.inventoryService.listSeats(data.showtimeId);
  }

  @GrpcMethod('InventoryService', 'ReserveSeat')
  async reserveSeat(data: { seatId: string; showtimeId: string; userName: string }) {
    return this.inventoryService.reserveSeat(data.seatId, data.showtimeId, data.userName);
  }

  @GrpcMethod('InventoryService', 'ResetData')
  async resetData() {
    return this.inventoryService.resetData();
  }
}
