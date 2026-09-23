import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { BookingModule } from './booking.module';

async function bootstrap() {
  const app = await NestFactory.create(BookingModule);

  let protoPath = process.env.BOOKING_PROTO_PATH;
  if (!protoPath) {
    const candidatePaths = [
      path.resolve(__dirname, '../../shared/protos/booking.proto'),
      path.resolve(__dirname, '../shared/protos/booking.proto'),
      path.resolve(process.cwd(), 'shared/protos/booking.proto'),
      path.resolve(process.cwd(), '../shared/protos/booking.proto'),
    ];
    protoPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
  }

  const grpcPort = process.env.GRPC_PORT || '50051';
  const httpPort = process.env.HTTP_PORT || '3001';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'booking',
      protoPath,
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort);

  const hostname = os.hostname();
  console.log(`[BOOKING-SERVICE] [HOST: ${hostname}] gRPC Microservice listening on 0.0.0.0:${grpcPort} (proto: ${protoPath})`);
  console.log(`[BOOKING-SERVICE] [HOST: ${hostname}] HTTP Health check listening on 0.0.0.0:${httpPort}`);
}
bootstrap();
