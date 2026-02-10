import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from './tenant.schema';
import { TenantService } from './tenant.service';
import { CompanyController } from './company.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }])],
  controllers: [CompanyController],
  providers: [TenantService],
  exports: [TenantService]
})
export class TenancyModule {}
