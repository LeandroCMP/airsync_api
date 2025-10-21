export default () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10)
  },
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/airsync'
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '900s',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '30d'
  },
  files: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxSize: 10 * 1024 * 1024
  },
  cors: {
    origins: process.env.CORS_ORIGINS || '*'
  }
});
