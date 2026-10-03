import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  Matches,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { QueueStatus } from '@prisma/client';

export class JoinQueueRequestDto {
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
  @IsString()
  customerEmail?: string;

  @IsArray()
  @IsNotEmpty()
  serviceIds: string[];

  @IsOptional()
  @IsString()
  preferredStaffId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReorderQueueDto {
  @IsInt()
  @Min(1)
  newPosition: number;

  @IsString()
  @IsNotEmpty({ message: 'Reason is required for queue priority modification' })
  reason: string;
}

export class UpdateQueueStatusDto {
  @IsEnum(QueueStatus)
  status: QueueStatus;

  @IsOptional()
  @IsString()
  staffId?: string;
}
