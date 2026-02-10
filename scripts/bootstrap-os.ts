import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../src/config/configuration';
import { MongooseModule , getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenancyModule } from '../src/core/tenancy/tenancy.module';
import { Tenant, TenantDocument } from '../src/core/tenancy/tenant.schema';
import { ClientsModule } from '../src/modules/clients/clients.module';
import { ClientsService } from '../src/modules/clients/clients.service';
import { LocationsModule } from '../src/modules/locations/locations.module';
import { LocationsService } from '../src/modules/locations/locations.service';
import { OrdersModule } from '../src/modules/orders/orders.module';
import { OrdersService } from '../src/modules/orders/orders.service';
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
    UsersModule,
    ClientsModule,
    LocationsModule,
    OrdersModule
  ]
})
class ScriptModule {}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

async function run() {
  const app = await NestFactory.createApplicationContext(ScriptModule, {
    logger: ['log', 'error', 'warn']
  });
  try {
    const tenantModel = app.get<Model<TenantDocument>>(getModelToken(Tenant.name));
    const usersService = app.get(UsersService);
    const clientsService = app.get(ClientsService);
    const locationsService = app.get(LocationsService);
    const ordersService = app.get(OrdersService);

    const args = parseArgs(process.argv.slice(2));
    const tenantId = args['tenant'] || args['tenantId'] || '68facb9cac8ce7bae460f4c4';
    const clientName = args['clientName'] || 'Cliente OS Automático';
    const label = args['locationLabel'] || 'Sede';

    const existingTenant = await tenantModel.findById(tenantId);
    if (!existingTenant) {
      throw new Error(`Tenant não encontrado: ${tenantId}`);
    }
    console.log(`Usando tenant: ${existingTenant.name} (${tenantId})`);

    // Choose an actor user id for audit fields
    const admins = await usersService.findAll(tenantId, 'admin');
    const anyUsers = admins.length ? admins : await usersService.findAll(tenantId);
    let actorId = 'system';
    if (anyUsers.length) {
      actorId = (anyUsers[0] as any)._id?.toString?.() || (anyUsers[0] as any).id || 'system';
    }

    // 1) Create client
    const client = await clientsService.create(tenantId, {
      name: clientName,
      phones: ['+55 11 99999-0000'],
      emails: ['cliente+os@example.local'],
      tags: ['os-auto']
    } as any, actorId);
    console.log('Cliente criado:', client);

    // 2) Create location
    const location = await locationsService.create(
      tenantId,
      {
        clientId: client._id || client.id,
        label,
        address: {
          street: 'Rua Exemplo',
          number: '123',
          city: 'São Paulo',
          state: 'SP',
          zip: '01000-000'
        },
        notes: 'Local criado automaticamente para abertura de OS'
      } as any,
      actorId
    );
    console.log('Local criado:', location);

    // 3) Create order (OS)
    const scheduledAt = new Date();
    const order = await ordersService.create(
      tenantId,
      {
        clientId: client._id || client.id,
        locationId: location._id || location.id,
        status: 'scheduled',
        scheduledAt,
        checklist: [{ item: 'Verificar funcionamento' }],
        notes: 'OS criada automaticamente'
      } as any,
      actorId
    );
    console.log('OS criada:', order);

    console.log('\nResumo:\n- tenantId: %s\n- clientId: %s\n- locationId: %s\n- orderId: %s',
      tenantId,
      (client as any)._id || (client as any).id,
      (location as any)._id || (location as any).id,
      (order as any)._id || (order as any).id
    );
  } catch (err) {
    console.error('Falha ao executar bootstrap de OS:', err);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

run();

