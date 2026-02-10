import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../src/config/configuration';
import { MongooseModule , getModelToken } from '@nestjs/mongoose';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersService } from '../src/modules/users/users.service';
import { Tenant, TenantDocument } from '../src/core/tenancy/tenant.schema';
import { TenancyModule } from '../src/core/tenancy/tenancy.module';
import { Model } from 'mongoose';
import { ALL_PERMISSION_CODES } from '../src/modules/users/user-permissions.constants';

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
    TenancyModule,
    UsersModule
  ]
})
class ScriptModule {}

async function run() {
  const app = await NestFactory.createApplicationContext(ScriptModule, {
    logger: ['log', 'error', 'warn']
  });

  const email = process.argv[2] || process.env.GRANT_ADMIN_EMAIL || 'ins4nehs@gmail.com';

  try {
    const usersService = app.get(UsersService);
    const tenantModel = app.get<Model<TenantDocument>>(getModelToken(Tenant.name));

    const user = await usersService.findByEmailAnyTenant(email);
    if (!user) {
      console.error(`User not found for email ${email}`);
      process.exitCode = 1;
      return;
    }
    const tenantId = user.tenantId?.toString?.();
    if (!tenantId) {
      console.error(`User ${email} does not have tenantId associated`);
      process.exitCode = 1;
      return;
    }

    const tenant = await tenantModel.findById(tenantId);
    if (!tenant) {
      console.error(`Tenant ${tenantId} not found`);
      process.exitCode = 1;
      return;
    }

    const updated = await usersService.update(
      tenantId,
      user._id.toString(),
      {
        role: 'admin',
        permissions: ALL_PERMISSION_CODES,
        active: true
      },
      'grant-admin-script'
    );

    console.log(`User ${email} updated as admin for tenant ${tenant.name} (${tenantId})`);
    console.log('Permissions applied:', updated.permissions);
  } catch (error) {
    console.error('Failed to grant admin permissions:', error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();
