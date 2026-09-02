import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AiModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
