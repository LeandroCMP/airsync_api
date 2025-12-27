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
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || ''
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
  },
  subscriptions: {
    amountInCents: process.env.SUBSCRIPTION_AMOUNT_IN_CENTS === 'true'
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || ''
  },
  whatsapp: {
    appId: process.env.WHATSAPP_APP_ID || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    redirectUri: process.env.WHATSAPP_REDIRECT_URI || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v19.0'
  }
});
