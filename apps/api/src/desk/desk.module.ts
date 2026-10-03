import { Module } from '@nestjs/common';
import { DeskService } from './desk.service';
import { DeskController } from './desk.controller';

@Module({
  providers: [DeskService],
  controllers: [DeskController],
  exports: [DeskService],
})
export class DeskModule {}
