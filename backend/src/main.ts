import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { execSync } from 'child_process';

;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString()
}

async function bootstrap() {
  // Push Drizzle schema on startup so the DB is always up-to-date
  // Uses drizzle-kit push which is idempotent (only applies differences)
  try {
    execSync('npx drizzle-kit push', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL! } });
  } catch (e) {
    console.error('Schema push failed (non-fatal, continuing):', (e as Error).message);
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
