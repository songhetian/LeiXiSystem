const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  // 核心安全配置：优先从 .env 读取，开发环境提供固定回退值确保一致性
  JWT_SECRET: process.env.JWT_SECRET || 'TZafsqtgW5t5EHRLJ49ca46rzoEfk37Lmx2hwxQR5m9KoQDYUmM5KhRyPKtxRccQ',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'REFRESH_SECRET_LX_SYSTEM_2024_PROD',
  
  // 数据库与环境
  isProd: process.env.NODE_ENV === 'production',
  PORT: process.env.PORT || 3001,

  // 阿里云 OSS 配置
  oss: {
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    secure: true,
    internal: process.env.OSS_INTERNAL === 'true' // 新增：是否使用阿里云内网访问
  }
};