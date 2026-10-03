import { Module } from '@nestjs/common';
import { FlowService } from './flow.service';
import { FlowController } from './flow.controller';
import { EtaEngineService } from './eta-engine.service';

@Module({
  providers: [FlowService, EtaEngineService],
  controllers: [FlowController],
  exports: [FlowService, EtaEngineService],
})
export class FlowModule {}
