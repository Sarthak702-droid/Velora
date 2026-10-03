import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Headers,
  Req,
  RawBodyRequest,
  BadRequestException,
} from "@nestjs/common";
import { Request } from "express";
import { PaymentsService } from "./payments.service";
import {
  CreateDepositOrderDto,
  CreatePremiumOrderDto,
  VerifyPaymentDto,
  PremiumProfileDto,
  ConciergeDto,
} from "./payments.dto";
import {
  Public,
  RequireFeature,
} from "../common/decorators/metadata.decorator";
import { CurrentTenant } from "../common/decorators/current.decorator";
@Controller("payments")
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Public() @Get("config") config() {
    return this.service.config();
  }
  @Public() @Post("premium-order") createPremium(
    @CurrentTenant() tenant: string,
    @Body() dto: CreatePremiumOrderDto,
  ) {
    return this.service.createPremiumOrder(tenant, dto);
  }
  @Public()
  @Post("deposit-order")
  @RequireFeature("pay.deposits")
  createDeposit(
    @CurrentTenant() tenant: string,
    @Body() dto: CreateDepositOrderDto,
    @Headers("x-private-receipt") receipt?: string,
  ) {
    return this.service.createDepositOrder(tenant, dto, receipt);
  }
  @Public() @Get(":id/checkout") checkout(
    @CurrentTenant() tenant: string,
    @Param("id") id: string,
    @Headers("x-private-receipt") receipt?: string,
  ) {
    return this.service.resumeCheckout(tenant, id, receipt);
  }
  @Public() @Get(":id/status") status(
    @CurrentTenant() tenant: string,
    @Param("id") id: string,
    @Headers("x-private-receipt") receipt?: string,
  ) {
    return this.service.status(tenant, id, receipt);
  }
  @Public() @Post(":id/verify") verify(
    @CurrentTenant() tenant: string,
    @Param("id") id: string,
    @Body() dto: VerifyPaymentDto,
    @Headers("x-private-receipt") receipt?: string,
  ) {
    return this.service.verifyPayment(tenant, id, dto, receipt);
  }
  @Public() @Get(":id/passport") passport(
    @CurrentTenant() tenant: string,
    @Param("id") id: string,
    @Headers("x-private-receipt") receipt?: string,
  ) {
    return this.service.passport(tenant, id, receipt);
  }
  @Public() @Put(":id/passport") savePassport(
    @CurrentTenant() tenant: string,
    @Param("id") id: string,
    @Body() dto: PremiumProfileDto,
    @Headers("x-private-receipt") receipt?: string,
  ) {
    return this.service.savePassport(tenant, id, dto, receipt);
  }
  @Public() @Post(":id/concierge") concierge(
    @CurrentTenant() tenant: string,
    @Param("id") id: string,
    @Body() dto: ConciergeDto,
    @Headers("x-private-receipt") receipt?: string,
  ) {
    return this.service.concierge(tenant, id, dto, receipt);
  }
  @Public() @Post("webhook/razorpay") webhook(
    @Headers("x-razorpay-signature") signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!req.rawBody)
      throw new BadRequestException("Raw webhook body is required");
    return this.service.handleRazorpayWebhook(signature, req.rawBody);
  }
}
