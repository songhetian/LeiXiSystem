const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const excludeFiles = ['websocket.js', 'apiClient.js'];

// 查找所有 .js/.jsx 文件
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      if (!excludeFiles.some(ex => file.endsWith(ex))) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);
let changedCount = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // 1. 替换 console 语句
  content = content.replace(/console\.log\(/g, 'logger.debug(');
  content = content.replace(/console\.info\(/g, 'logger.info(');
  content = content.replace(/console\.warn\(/g, 'logger.warn(');
  content = content.replace(/console\.error\(/g, 'logger.error(');

  // 2. 如果内容发生了变化，且没有引入 logger，则注入 import
  if (content !== originalContent) {
    if (!content.includes("import logger from '@/utils/logger'") && !content.includes('import logger from "@/utils/logger"')) {
      // 注入到文件顶部
      content = `import logger from '@/utils/logger';\n${content}`;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    changedCount++;
  }
});

console.log(`Successfully refactored ${changedCount} files.`);
