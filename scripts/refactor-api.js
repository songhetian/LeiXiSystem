const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');
const excludeFiles = ['api.js', 'apiClient.js'];

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

  // 1. 检查是否使用了 axios
  if (content.includes('axios.')) {
    // 替换 axios. 为 api.
    content = content.replace(/axios\.(get|post|put|delete|patch)/g, 'api.$1');
    
    // 2. 移除 import axios
    content = content.replace(/import\s+axios\s+from\s+['"]axios['"];?\n?/g, '');
    
    // 3. 注入 import api
    if (!content.includes("import api from '@/api'") && !content.includes('import api from "@/api"')) {
      content = `import api from '@/api';\n${content}`;
    }

    // 4. 清理冗余的 headers: { Authorization: ... }
    // 匹配类似 headers: { 'Authorization': ... } 或 headers: { Authorization: ... }
    content = content.replace(/,\s*{\s*headers:\s*{\s*['"]?Authorization['"]?:\s*`Bearer \${.*?}`\s*}\s*}/g, '');
    content = content.replace(/{\s*headers:\s*{\s*['"]?Authorization['"]?:\s*`Bearer \${.*?}`\s*}\s*}/g, '');
    // 匹配更通用的 token 获取 headers
    content = content.replace(/,\s*{\s*headers:\s*{\s*['"]?Authorization['"]?:\s*['"]Bearer ['"]\s*\+\s*localStorage\.getItem\(.*?\)\s*}\s*}/g, '');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      changedCount++;
    }
  }
});

console.log(`Successfully refactored ${changedCount} files to use unified api instance.`);
