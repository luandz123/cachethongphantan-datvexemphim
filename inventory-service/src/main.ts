import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as path from 'path';
import * as fs from 'fs';
import { InventoryModule } from './inventory.module';

async function bootstrap() {
  const app = await NestFactory.create(InventoryModule);

  // Determine proto path (supports Docker container and local development)
  let protoPath = process.env.PROTO_PATH;
  if (!protoPath) {
    const candidatePaths = [
      path.resolve(__dirname, '../../shared/protos/inventory.proto'),
      path.resolve(__dirname, '../shared/protos/inventory.proto'),
      path.resolve(process.cwd(), 'shared/protos/inventory.proto'),
      path.resolve(process.cwd(), '../shared/protos/inventory.proto'),
    ];
    protoPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
  }

  const grpcPort = process.env.GRPC_PORT || '50052';
  const httpPort = process.env.HTTP_PORT || '3002';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'inventory',
      protoPath,
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();
  await app.listen(httpPort);

  console.log(`[INVENTORY-SERVICE] gRPC Microservice listening on 0.0.0.0:${grpcPort} (proto: ${protoPath})`);
  console.log(`[INVENTORY-SERVICE] HTTP Health check listening on 0.0.0.0:${httpPort}`);
}
bootstrap();
