import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('App E2E', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    process.env.UPLOAD_DIR = './uploads-test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    connection = await moduleFixture.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
    if (mongod) await mongod.stop();
  });

  it('registers, logs in and creates client', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        tenantName: 'Test Co',
        name: 'Tester',
        email: 'tester@example.com',
        password: 'secret123'
      })
      .expect(201);

    const { tenantId } = registerRes.body;

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .set('x-tenant-id', tenantId)
      .send({ email: 'tester@example.com', password: 'secret123' })
      .expect(200);

    const token = loginRes.body.accessToken;

    const clientRes = await request(app.getHttpServer())
      .post('/v1/clients')
      .set('x-tenant-id', tenantId)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Teste', phones: ['+5511'], emails: ['cliente@example.com'] })
      .expect(201);

    expect(clientRes.body.name).toBe('Cliente Teste');
  });
});
