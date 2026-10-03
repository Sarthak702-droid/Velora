import {
  IsString,
  IsOptional,
  IsEmail,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
} from "class-validator";
export class CreateDepositOrderDto {
  @IsString() @MaxLength(100) appointmentId: string;
}
export class CreatePremiumOrderDto {
  @IsString() @MinLength(2) @MaxLength(100) customerName: string;
  @IsString() @Matches(/^\+?[0-9]{8,15}$/) customerPhone: string;
  @IsOptional() @IsEmail() customerEmail?: string;
}
export class VerifyPaymentDto {
  @IsString() @MaxLength(100) paymentId: string;
  @IsString() @MaxLength(100) orderId: string;
  @IsString() @Matches(/^[a-f0-9]{64}$/) signature: string;
}
export class PremiumProfileDto {
  @IsString() @MaxLength(80) lookName: string;
  @IsString() @MaxLength(1200) styleNotes: string;
  @IsString() @MaxLength(300) preferences: string;
}
export class ConciergeDto {
  @IsString() @MaxLength(100) branchId: string;
  @IsString() @MaxLength(100) categoryId: string;
  @IsNumber() @Min(1) @Max(1000000) budget: number;
  @IsNumber() @Min(1) @Max(600) minutes: number;
}
