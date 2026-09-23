import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsNotEmpty({ message: 'showtimeId is required' })
  @IsString({ message: 'showtimeId must be a string' })
  showtimeId: string;

  @IsNotEmpty({ message: 'seatId is required' })
  @IsString({ message: 'seatId must be a string' })
  seatId: string;

  @IsNotEmpty({ message: 'userName is required' })
  @IsString({ message: 'userName must be a string' })
  userName: string;
}
