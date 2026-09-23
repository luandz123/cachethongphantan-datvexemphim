import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import * as os from 'os';
import { Showtime } from './entities/showtime.entity';
import { Seat } from './entities/seat.entity';

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger('InventoryService');
  private readonly hostname = os.hostname();

  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepo: Repository<Showtime>,
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    private readonly dataSource: DataSource,
  ) {}

  private getLockStrategy(): 'pessimistic' | 'optimistic' {
    const strategy = (process.env.LOCK_STRATEGY || 'pessimistic').toLowerCase();
    return strategy === 'optimistic' ? 'optimistic' : 'pessimistic';
  }

  async onModuleInit() {
    this.logInfo(`Initializing Inventory Service. Current LOCK_STRATEGY = ${this.getLockStrategy().toUpperCase()}`);
    await this.seedData();
  }

  private logInfo(message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[INVENTORY-SERVICE] [HOST: ${this.hostname}] [TIME: ${timestamp}] ${message}`);
  }

  private logWarn(message: string) {
    const timestamp = new Date().toISOString();
    console.warn(`[INVENTORY-SERVICE] [HOST: ${this.hostname}] [TIME: ${timestamp}] ⚠️ ${message}`);
  }

  private logError(message: string) {
    const timestamp = new Date().toISOString();
    console.error(`[INVENTORY-SERVICE] [HOST: ${this.hostname}] [TIME: ${timestamp}] ❌ ${message}`);
  }

  async seedData() {
    try {
      let showtime = await this.showtimeRepo.findOne({ where: { id: '1' } });
      if (!showtime) {
        showtime = this.showtimeRepo.create({
          id: '1',
          movieName: 'Avengers: Secret Wars',
          room: 'Cinema Hall 1',
          showTime: '2026-10-01T19:30:00Z',
        });
        await this.showtimeRepo.save(showtime);
        this.logInfo('Created seed showtime: Avengers: Secret Wars (Hall 1)');
      }

      const count = await this.seatRepo.count({ where: { showtimeId: '1' } });
      if (count === 0) {
        const seats: Seat[] = [];
        for (let i = 1; i <= 20; i++) {
          const seatCode = `A${i}`;
          // Deliberately make A1-A19 BOOKED, only A20 is AVAILABLE to demo race condition!
          const seatStatus = i === 20 ? 'available' : 'booked';
          seats.push(
            this.seatRepo.create({
              id: `${i}`,
              showtimeId: '1',
              seatCode,
              status: seatStatus,
              version: 1,
            }),
          );
        }
        await this.seatRepo.save(seats);
        this.logInfo('Created 20 seed seats (A1-A19 BOOKED, A20 AVAILABLE for race condition demo)');
      }
    } catch (err) {
      this.logError(`Error during seedData: ${err.message}`);
    }
  }

  async resetData() {
    this.logInfo('Resetting inventory data to initial demo state...');
    for (let i = 1; i <= 20; i++) {
      const seatStatus = i === 20 ? 'available' : 'booked';
      await this.seatRepo.update(
        { id: `${i}` },
        { status: seatStatus, version: 1 },
      );
    }
    this.logInfo('Inventory data successfully reset (Seat A20 is available)');
    return { success: true, message: 'Inventory reset successfully. Seat A20 is now available.' };
  }

  async getShowtime(showtimeId: string) {
    const showtime = await this.showtimeRepo.findOne({ where: { id: showtimeId } });
    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime with ID ${showtimeId} not found`,
      });
    }
    return showtime;
  }

  async listSeats(showtimeId: string) {
    const seats = await this.seatRepo.find({
      where: { showtimeId },
      order: { id: 'ASC' },
    });
    return { seats };
  }

  async reserveSeat(seatId: string, showtimeId: string, userName: string) {
    const strategy = this.getLockStrategy();
    this.logInfo(`[LOCK=${strategy.toUpperCase()}] Reserve request for seatId=${seatId} by user="${userName}"`);

    const showtime = await this.showtimeRepo.findOne({ where: { id: showtimeId } });
    if (!showtime) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Showtime ${showtimeId} not found`,
      });
    }

    if (strategy === 'pessimistic') {
      return this.reserveSeatPessimistic(seatId, showtime, userName);
    } else {
      return this.reserveSeatOptimistic(seatId, showtime, userName);
    }
  }

  /**
   * PESSIMISTIC LOCKING:
   * Uses Postgres 'SELECT ... FOR UPDATE' in a database transaction.
   * Other concurrent transactions trying to lock the same row will wait until this transaction completes.
   */
  private async reserveSeatPessimistic(seatId: string, showtime: Showtime, userName: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logInfo(`[PESSIMISTIC] Acquiring SELECT FOR UPDATE lock on seatId=${seatId}...`);
      const seat = await queryRunner.manager.findOne(Seat, {
        where: { id: seatId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!seat) {
        throw new RpcException({
          code: status.NOT_FOUND,
          message: `Seat with ID ${seatId} not found`,
        });
      }

      if (seat.status !== 'available') {
        this.logWarn(`[PESSIMISTIC] Seat ${seat.seatCode} is ALREADY BOOKED! Rejecting user="${userName}"`);
        throw new RpcException({
          code: status.ALREADY_EXISTS,
          message: `Seat ${seat.seatCode} is already booked`,
        });
      }

      // Mark seat as booked
      seat.status = 'booked';
      await queryRunner.manager.save(seat);
      await queryRunner.commitTransaction();

      this.logInfo(`[PESSIMISTIC] Seat ${seat.seatCode} successfully locked & reserved for user="${userName}"`);

      return {
        success: true,
        message: `Seat ${seat.seatCode} reserved successfully via Pessimistic Lock`,
        seatId: seat.id,
        seatCode: seat.seatCode,
        movieName: showtime.movieName,
        showtimeId: showtime.id,
        processedByHost: this.hostname,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      if (err instanceof RpcException) throw err;
      this.logError(`[PESSIMISTIC] Transaction error: ${err.message}`);
      throw new RpcException({
        code: status.INTERNAL,
        message: `Database transaction failed: ${err.message}`,
      });
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * OPTIMISTIC LOCKING:
   * Checks the version column before updating:
   * UPDATE seats SET status='booked', version=version+1 WHERE id=:id AND version=:version AND status='available'
   * If another transaction updated the row first, affected rows = 0 -> throws Concurrency Conflict.
   */
  private async reserveSeatOptimistic(seatId: string, showtime: Showtime, userName: string) {
    this.logInfo(`[OPTIMISTIC] Reading seatId=${seatId} to get current version...`);
    const seat = await this.seatRepo.findOne({ where: { id: seatId } });

    if (!seat) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: `Seat with ID ${seatId} not found`,
      });
    }

    if (seat.status !== 'available') {
      this.logWarn(`[OPTIMISTIC] Seat ${seat.seatCode} is ALREADY BOOKED! Rejecting user="${userName}"`);
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: `Seat ${seat.seatCode} is already booked`,
      });
    }

    const currentVersion = seat.version;
    this.logInfo(`[OPTIMISTIC] Attempting atomic UPDATE for seat ${seat.seatCode} with version=${currentVersion}...`);

    const updateResult = await this.seatRepo
      .createQueryBuilder()
      .update(Seat)
      .set({
        status: 'booked',
        version: () => 'version + 1',
      })
      .where('id = :id AND version = :version AND status = :status', {
        id: seatId,
        version: currentVersion,
        status: 'available',
      })
      .execute();

    if (updateResult.affected === 0) {
      this.logWarn(`[OPTIMISTIC] Conflict detected! Another request reserved seat ${seat.seatCode} first! Version changed from ${currentVersion}. Rejecting user="${userName}"`);
      throw new RpcException({
        code: status.ABORTED,
        message: `Optimistic Lock Conflict: Seat ${seat.seatCode} was updated by a concurrent transaction (version conflict)`,
      });
    }

    this.logInfo(`[OPTIMISTIC] Seat ${seat.seatCode} reserved successfully (new version = ${currentVersion + 1}) for user="${userName}"`);

    return {
      success: true,
      message: `Seat ${seat.seatCode} reserved successfully via Optimistic Lock`,
      seatId: seat.id,
      seatCode: seat.seatCode,
      movieName: showtime.movieName,
      showtimeId: showtime.id,
      processedByHost: this.hostname,
      timestamp: new Date().toISOString(),
    };
  }
}
