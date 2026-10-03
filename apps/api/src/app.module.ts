import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './security/security.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { EventsModule } from './events/events.module';
import { TenantsModule } from './tenants/tenants.module';
import { BranchesModule } from './branches/branches.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { ServicesModule } from './services/services.module';
import { StaffModule } from './staff/staff.module';
import { BookingsModule } from './bookings/bookings.module';
import { QueueModule } from './queue/queue.module';
import { FlowModule } from './flow/flow.module';
import { DeskModule } from './desk/desk.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CustomersModule } from './customers/customers.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';

import { ContextMiddleware } from './common/middleware/context.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { FeatureEntitlementGuard } from './common/guards/feature-entitlement.guard';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    SecurityModule,
    AuthModule,
    AuditModule,
    EventsModule,
    TenantsModule,
    BranchesModule,
    SubscriptionsModule,
    ServicesModule,
    StaffModule,
    BookingsModule,
    QueueModule,
    FlowModule,
    DeskModule,
    NotificationsModule,
    CustomersModule,
    PaymentsModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FeatureEntitlementGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContextMiddleware).forRoutes('*');
  }
}
