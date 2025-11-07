import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../src/config/configuration';
import { MongooseModule , getModelToken } from '@nestjs/mongoose';
import { UsersService } from '../src/modules/users/users.service';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from '../src/core/tenancy/tenant.schema';
import { TenancyModule } from '../src/core/tenancy/tenancy.module';
import { UsersModule } from '../src/modules/users/users.module';

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
  try {
    const tenantModel = app.get<Model<TenantDocument>>(getModelToken(Tenant.name));
    const usersService = app.get(UsersService);

    let tenant = await tenantModel.findOne();
    if (!tenant) {
      tenant = await tenantModel.create({ name: 'Demo' });
      console.log(`Created tenant: ${tenant.name} (${tenant._id.toString()})`);
    } else {
      console.log(`Using tenant: ${tenant.name} (${tenant._id.toString()})`);
    }

    const email = 'teste@airsync.local';
    const existing = await usersService.findByEmail(tenant._id.toString(), email);
    if (existing) {
      console.log(`User already exists: ${email}`);
      return;
    }

    const created = await usersService.create(
      tenant._id.toString(),
      {
        name: 'Usuário Teste',
        email,
        password: 'teste123',
        role: 'viewer',
        permissions: [],
        active: true
      },
      'system'
    );

    console.log('Test user created:', created);
  } catch (err) {
    console.error('Failed to create test user:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();
