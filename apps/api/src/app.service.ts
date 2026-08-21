import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'ai-salesos-api',
      timestamp: new Date().toISOString(),
    };
  }
}
