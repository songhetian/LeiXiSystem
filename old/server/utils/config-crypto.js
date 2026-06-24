const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 配置文件加密/解密工具
 * 使用 AES-256-GCM 加密算法
 */

// 加密密钥（生产环境应该从环境变量或安全存储中获取）
// 这里使用固定密钥仅作为示例，实际部署时应该修改
const ENCRYPTION_KEY = process.env.CONFIG_ENCRYPTION_KEY || 'LeiXi-Customer-Service-2024-Secret-Key-32Bytes!!';
const ALGORITHM = 'aes-256-gcm';

/**
 * 生成32字节的密钥
 */
function getKey() {
  // 将密钥字符串转换为32字节的Buffer
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * 加密配置对象
 * @param {Object} config - 配置对象
 * @returns {Object} 加密后的数据 {encrypted: string, iv: string, authTag: string}
 */
function encryptConfig(config) {
  try {
    // 生成随机初始化向量
    const iv = crypto.randomBytes(16);

    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

    // 将配置对象转换为JSON字符串并加密
    const configStr = JSON.stringify(config);
    let encrypted = cipher.update(configStr, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    console.error('配置加密失败:', error);
    throw error;
  }
}

/**
 * 解密配置数据
 * @param {Object} encryptedData - 加密数据 {encrypted, iv, authTag}
 * @returns {Object} 解密后的配置对象
 */
function decryptConfig(encryptedData) {
  try {
    // 创建解密器
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      getKey(),
      Buffer.from(encryptedData.iv, 'hex')
    );

    // 设置认证标签
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    // 解密
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // 解析JSON
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('配置解密失败:', error);
    throw error;
  }
}

/**
 * 加密配置文件
 * @param {string} inputPath - 原始配置文件路径
 * @param {string} outputPath - 加密后的配置文件路径
 */
function encryptConfigFile(inputPath, outputPath) {
  try {
    // 读取原始配置
    const configData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // 加密
    const encrypted = encryptConfig(configData);

    // 保存加密后的配置
    fs.writeFileSync(outputPath, JSON.stringify(encrypted, null, 2), 'utf8');

    console.log(`✅ 配置文件已加密: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('❌ 加密配置文件失败:', error);
    return false;
  }
}

/**
 * 解密配置文件
 * @param {string} inputPath - 加密的配置文件路径
 * @param {string} outputPath - 解密后的配置文件路径（可选）
 * @returns {Object} 解密后的配置对象
 */
function decryptConfigFile(inputPath, outputPath = null) {
  try {
    // 读取加密的配置
    const encryptedData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // 解密
    const config = decryptConfig(encryptedData);

    // 如果指定了输出路径，保存解密后的配置
    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf8');
      console.log(`✅ 配置文件已解密: ${outputPath}`);
    }

    return config;
  } catch (error) {
    console.error('❌ 解密配置文件失败:', error);
    throw error;
  }
}

/**
 * 加载配置文件（自动检测是否加密）
 * @param {string} configPath - 配置文件路径
 * @returns {Object} 配置对象
 */
function loadConfig(configPath) {
  try {
    if (!fs.existsSync(configPath)) {
      console.warn(`⚠️ 配置文件不存在: ${configPath}`);
      return {};
    }

    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // 检查是否是加密的配置（包含 encrypted, iv, authTag 字段）
    if (configData.encrypted && configData.iv && configData.authTag) {
      console.log('🔓 检测到加密配置，正在解密...');
      return decryptConfig(configData);
    } else {
      console.log('📄 加载明文配置');
      return configData;
    }
  } catch (error) {
    console.error('❌ 加载配置失败:', error);
    return {};
  }
}

module.exports = {
  encryptConfig,
  decryptConfig,
  encryptConfigFile,
  decryptConfigFile,
  loadConfig
};
