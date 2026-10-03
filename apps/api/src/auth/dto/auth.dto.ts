import { IsEmail, IsNotEmpty, IsString, MinLength, Matches, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

export class CustomerOtpRequestDto {
  @IsString()
  @Matches(/^\+?[\d\s()-]{8,18}$/, { message: 'Enter a valid phone number' })
  phone: string;
}

export class CustomerOtpVerifyDto {
  @IsString()
  @Matches(/^\+?[\d\s()-]{8,18}$/, { message: 'Enter a valid phone number' })
  phone: string;

  @IsString()
  @MinLength(4, { message: 'OTP must be at least 4 digits' })
  otp: string;

  @IsOptional()
  @IsString()
  name?: string;
}
