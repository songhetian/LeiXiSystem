const fs = require('fs');
const path = require('path');

// 数据库配置向导
console.log('=== 客服管理系统配置向导 ===\n');

// 获取用户输入
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const configPath = path.join(__dirname, 'config/db-config.json');

// 默认配置
const defaultConfig = {
  database: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'your_password',
    database: 'leixin_customer_service'
  },
  upload: {
    sharedDirectory: '',
    publicUrl: ''
  }
};

// 检查是否已存在配置文件
if (fs.existsSync(configPath)) {
  console.log('⚠️  发现现有配置文件');
  readline.question('是否要重新配置系统设置？(y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      askDatabaseConfig();
    } else {
      console.log('✅ 使用现有配置');
      readline.close();
    }
  });
} else {
  askDatabaseConfig();
}

function askDatabaseConfig() {
  console.log('\n请提供数据库连接信息：\n');

  readline.question('数据库主机地址 (默认: localhost): ', (host) => {
    defaultConfig.database.host = host || 'localhost';

    readline.question('数据库端口 (默认: 3306): ', (port) => {
      defaultConfig.database.port = parseInt(port) || 3306;

      readline.question('数据库用户名 (默认: root): ', (user) => {
        defaultConfig.database.user = user || 'root';

        readline.question('数据库密码 (默认: your_password): ', (password) => {
          defaultConfig.database.password = password || 'your_password';

          readline.question('数据库名称 (默认: leixin_customer_service): ', (database) => {
            defaultConfig.database.database = database || 'leixin_customer_service';

            console.log('\n文件上传配置（可选）：\n');
            readline.question('共享上传目录路径 (可选，用于多电脑共享文件): ', (sharedDir) => {
              if (sharedDir) {
                defaultConfig.upload.sharedDirectory = sharedDir;
              }

              readline.question('公共访问URL (可选，用于网络访问上传文件): ', (publicUrl) => {
                if (publicUrl) {
                  defaultConfig.upload.publicUrl = publicUrl;
                }

                // 保存配置文件
                const configDir = path.dirname(configPath);
                if (!fs.existsSync(configDir)) {
                  fs.mkdirSync(configDir, { recursive: true });
                }

                fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
                console.log('\n✅ 系统配置已保存到:', configPath);
                console.log('\n配置详情:');
                console.log('- 数据库主机:', defaultConfig.database.host);
                console.log('- 数据库端口:', defaultConfig.database.port);
                console.log('- 数据库用户:', defaultConfig.database.user);
                console.log('- 数据库名称:', defaultConfig.database.database);
                if (defaultConfig.upload.sharedDirectory) {
                  console.log('- 共享目录:', defaultConfig.upload.sharedDirectory);
                }
                if (defaultConfig.upload.publicUrl) {
                  console.log('- 公共URL:', defaultConfig.upload.publicUrl);
                }
                console.log('\n⚠️  注意：密码已保存在配置文件中，请确保文件安全');

                readline.close();
              });
            });
          });
        });
      });
    });
  });
}
