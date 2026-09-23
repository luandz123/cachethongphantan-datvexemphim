import { Entity, PrimaryColumn, Column, VersionColumn, Index } from 'typeorm';

export type SeatStatus = 'available' | 'booked';

@Entity('seats')
export class Seat {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Index()
  @Column({ name: 'showtime_id', type: 'varchar', length: 50 })
  showtimeId: string;

  @Column({ name: 'seat_code', type: 'varchar', length: 20 })
  seatCode: string;

  @Column({ type: 'varchar', length: 20, default: 'available' })
  status: SeatStatus;

  @VersionColumn({ default: 1 })
  version: number;
}
