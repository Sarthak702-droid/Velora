import {
  Controller,
  Post,
  Body,
  Get,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, CustomerOtpRequestDto, CustomerOtpVerifyDto } from './dto/auth.dto';
import { Public } from '../common/decorators/metadata.decorator';
import { CurrentUser } from '../common/decorators/current.decorator';
import { VeloraRequest } from '../common/middleware/context.middleware';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('customer/otp/request')
  async requestOtp(@Body() dto: CustomerOtpRequestDto, @Ip() ipAddress: string) {
    return this.authService.requestCustomerOtp(dto, ipAddress);
  }

  @Public()
  @Post('customer/otp/verify')
  async verifyOtp(@Body() dto: CustomerOtpVerifyDto, @Req() req: VeloraRequest) {
    return this.authService.verifyCustomerOtp(dto, req.tenantId);
  }

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return user;
  }
}
