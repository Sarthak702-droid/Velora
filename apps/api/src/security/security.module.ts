import { ReceiptService } from './receipt.service';
import { Global, Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { OtpService } from './otp.service';
import { IdempotencyService } from './idempotency.service';

@Global()
@Module({
  providers: [SecurityService, OtpService, IdempotencyService, ReceiptService],
  exports: [SecurityService, OtpService, IdempotencyService, ReceiptService],
})
export class SecurityModule {}
