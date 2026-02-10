import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Auth Email Uniqueness E2E', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let connection: Connection;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    process.env.UPLOAD_DIR = './uploads-test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
    connection = await moduleFixture.get(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await app.close();
    if (mongod) await mongod.stop();
  });

  it('prevents registering same email in another tenant', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        tenantName: 'Company A',
        name: 'User A',
        email: 'unique@example.com',
        password: 'passA123'
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        tenantName: 'Company B',
        name: 'User B',
        email: 'unique@example.com',
        password: 'passB123'
      })
      .expect(409);

    expect(res.body.message || res.body.error || '').toMatch(/email/i);
  });
});

