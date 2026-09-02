import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  /** Production readiness probe (PRD §22 Monitoring) — checks the DB is actually reachable,
   * not just that the process is running, so a load balancer/orchestrator can route around it. */
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'ai-salesos-api',
        database: 'unreachable',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      service: 'ai-salesos-api',
      database: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
