import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Auth Login E2E', () => {
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

  it('registers and logs in successfully', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        tenantName: 'Login Test Co',
        name: 'User Test',
        email: 'login.tester@example.com',
        password: 'secret123'
      })
      .expect(201);

    const { tenantId } = registerRes.body;

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'login.tester@example.com', password: 'secret123' })
      .expect(200);

    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body).toHaveProperty('refreshToken');
    expect(loginRes.body).toHaveProperty('user');
    expect(loginRes.body.user.email).toBe('login.tester@example.com');

    const meRes = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);

    expect(meRes.body).toHaveProperty('id');
    expect(meRes.body).toHaveProperty('tenantId', tenantId);
  });
});
