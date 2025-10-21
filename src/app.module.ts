import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { LocationsModule } from './modules/locations/locations.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { FinanceModule } from './modules/finance/finance.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { CrmModule } from './modules/crm/crm.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SyncModule } from './sync/sync.module';
import { PdfModule } from './pdf/pdf.module';
import { FilesModule } from './core/files/files.module';
import { TenancyModule } from './core/tenancy/tenancy.module';
import { SeedModule } from './seeds/seed.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard';
import { TenantGuard } from './core/tenancy/tenant.guard';
import { RbacGuard } from './core/rbac/rbac.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditModule } from './core/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        uri: config.get<string>('database.uri')
      })
    }),
    FilesModule,
    AuditModule,
    PdfModule,
    TenancyModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    LocationsModule,
    EquipmentModule,
    InventoryModule,
    SuppliersModule,
    PurchasesModule,
    FinanceModule,
    OrdersModule,
    ContractsModule,
    FleetModule,
    CrmModule,
    ReportsModule,
    SyncModule,
    SeedModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RbacGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }
  ]
})
export class AppModule {}
