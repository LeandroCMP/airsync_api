import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../src/config/configuration';
import { MongooseModule , getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenancyModule } from '../src/core/tenancy/tenancy.module';
import { Tenant, TenantDocument } from '../src/core/tenancy/tenant.schema';
import { UsersModule } from '../src/modules/users/users.module';
import { UsersService } from '../src/modules/users/users.service';

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
  const TENANT_NAME = 'azevedo climatização';
  const USER_NAME = 'Leandro de Souza Campos';
  const USER_EMAIL = 'ins4nehs@gmail.com';
  const USER_PASSWORD = '1ns4neHS@';

  const app = await NestFactory.createApplicationContext(ScriptModule, {
    logger: ['log', 'error', 'warn']
  });
  try {
    const tenantModel = app.get<Model<TenantDocument>>(getModelToken(Tenant.name));
    const usersService = app.get(UsersService);

    let tenant = await tenantModel.findOne({ name: TENANT_NAME });
    if (!tenant) {
      tenant = await tenantModel.create({ name: TENANT_NAME });
      console.log(`Created tenant: ${tenant.name} (${tenant._id.toString()})`);
    } else {
      console.log(`Using tenant: ${tenant.name} (${tenant._id.toString()})`);
    }

    const existing = await usersService.findByEmail(tenant._id.toString(), USER_EMAIL);
    if (existing) {
      console.log(`User already exists for tenant '${TENANT_NAME}': ${USER_EMAIL}`);
      return;
    }

    const created = await usersService.create(
      tenant._id.toString(),
      {
        name: USER_NAME,
        email: USER_EMAIL,
        password: USER_PASSWORD,
        role: 'admin',
        permissions: ['*'],
        active: true
      } as any,
      'system'
    );

    console.log('Owner user created:', created);
  } catch (err) {
    console.error('Failed to create owner user:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();

