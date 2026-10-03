import { RazorpayGateway } from "./razorpay.gateway";
import { Module } from "@nestjs/common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";

@Module({
  providers: [PaymentsService, RazorpayGateway],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
