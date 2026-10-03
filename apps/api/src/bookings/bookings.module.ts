import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { DynamicSlotEngine } from './dynamic-slot.engine';

@Module({
  providers: [BookingsService, DynamicSlotEngine],
  controllers: [BookingsController],
  exports: [BookingsService, DynamicSlotEngine],
})
export class BookingsModule {}
