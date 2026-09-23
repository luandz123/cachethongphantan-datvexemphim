import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('showtimes')
export class Showtime {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string;

  @Column({ name: 'movie_name', type: 'varchar', length: 255 })
  movieName: string;

  @Column({ type: 'varchar', length: 100 })
  room: string;

  @Column({ name: 'show_time', type: 'varchar', length: 100 })
  showTime: string;
}
