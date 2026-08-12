#!/usr/bin/env node

/**
 * 配置文件解密工具
 * 用法: node scripts/decrypt-config.js
 */

const path = require('path');
const { decryptConfigFile } = require('../server/utils/config-crypto');

const inputPath = path.join(__dirname, '../config/db-config.json');
const outputPath = path.join(__dirname, '../config/db-config.decrypted.json');

console.log('============================================');
console.log('   配置文件解密工具');
console.log('============================================');
console.log('');
console.log(`输入文件: ${inputPath}`);
console.log(`输出文件: ${outputPath}`);
console.log('');

try {
  const config = decryptConfigFile(inputPath, outputPath);

  console.log('');
  console.log('✅ 解密成功！');
  console.log('');
  console.log('📋 解密后的配置:');
  console.log(JSON.stringify(config, null, 2));
  console.log('');
  console.log(`已保存到: ${outputPath}`);
} catch (error) {
  console.log('');
  console.log('❌ 解密失败，请检查错误信息');
  console.log('可能的原因:');
  console.log('1. 配置文件未加密');
  console.log('2. 加密密钥不正确');
  console.log('3. 配置文件已损坏');
  process.exit(1);
}
