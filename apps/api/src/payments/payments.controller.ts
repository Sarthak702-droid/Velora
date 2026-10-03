import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
} from '@nestjs/common';
import { PaymentsService, CreateDepositOrderDto, VerifyPaymentDto } from './payments.service';
import { Public, RequireFeature } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { Request } from 'express';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('deposit-order')
  @RequireFeature('pay.deposits')
  async createDepositOrder(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateDepositOrderDto,
  ) {
    return this.paymentsService.createDepositOrder(tenantId, dto);
  }

  @Public()
  @Post('verify')
  @RequireFeature('pay.deposits')
  async verifyPayment(
    @CurrentTenant() tenantId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(tenantId, dto);
  }

  @Public()
  @Post('webhook/razorpay')
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: Request,
  ) {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    return this.paymentsService.handleRazorpayWebhook(signature, rawBody);
  }
}
