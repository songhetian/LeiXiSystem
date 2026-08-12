#!/usr/bin/env node

/**
 * 配置文件加密工具
 * 用法: node scripts/encrypt-config.js
 */

const path = require('path');
const { encryptConfigFile } = require('../server/utils/config-crypto');

const inputPath = path.join(__dirname, '../config/db-config.json');
const outputPath = path.join(__dirname, '../config/db-config.encrypted.json');

console.log('============================================');
console.log('   配置文件加密工具');
console.log('============================================');
console.log('');
console.log(`输入文件: ${inputPath}`);
console.log(`输出文件: ${outputPath}`);
console.log('');

const success = encryptConfigFile(inputPath, outputPath);

if (success) {
  console.log('');
  console.log('✅ 加密成功！');
  console.log('');
  console.log('📋 下一步操作:');
  console.log('1. 备份原始配置文件 db-config.json');
  console.log('2. 将 db-config.encrypted.json 重命名为 db-config.json');
  console.log('3. 删除原始的明文配置文件');
  console.log('');
  console.log('⚠️ 注意: 加密密钥存储在环境变量 CONFIG_ENCRYPTION_KEY 中');
  console.log('       如果未设置，将使用默认密钥（不安全）');
} else {
  console.log('');
  console.log('❌ 加密失败，请检查错误信息');
  process.exit(1);
}
