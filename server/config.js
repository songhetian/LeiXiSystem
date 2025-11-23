// 数据库配置
module.exports = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'leixin_customer_service',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || '0.0.0.0'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'TZafsqtgW5t5EHRLJ49ca46rzoEfk37Lmx2hwxQR5m9KoQDYUmM5KhRyPKtxRccQ',
    expiresIn: '7d'
  }
}
