import { Global, Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { OtpService } from './otp.service';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  providers: [SecurityService, OtpService, IdempotencyService],
  exports: [SecurityService, OtpService, IdempotencyService],
})
export class SecurityModule {}
