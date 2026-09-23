import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('bookings')
export class Booking {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ name: 'seat_id', type: 'varchar', length: 50 })
  seatId: string;

  @Column({ name: 'showtime_id', type: 'varchar', length: 50 })
  showtimeId: string;

  @Column({ name: 'user_name', type: 'varchar', length: 100 })
  userName: string;

  @Column({ type: 'varchar', length: 20, default: 'CONFIRMED' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
