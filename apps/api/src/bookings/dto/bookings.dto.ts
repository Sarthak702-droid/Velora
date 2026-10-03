import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
  Matches,
  IsEmail,
} from 'class-validator';

export class CreateBookingRequestDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @Matches(/^\+?[\d\s()-]{8,18}$/, { message: 'Enter a valid phone number' })
  customerPhone: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  serviceIds: string[];

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be formatted as YYYY-MM-DD' })
  dateStr: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Time must be formatted as HH:mm' })
  timeStr: string;

  @IsOptional()
  @IsString()
  staffId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelBookingDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class RescheduleBookingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateStr: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  timeStr: string;
}
