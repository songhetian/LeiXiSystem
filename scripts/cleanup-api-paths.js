const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.cwd(), 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcDir);
let changedCount = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;

  // 1. 匹配 api.get('/api/xxx'), api.post('/api/xxx') 等
  // 注意：我们只匹配引号内部以 /api/ 开头的路径
  content = content.replace(/(api\.(get|post|put|delete|patch)\(['"])\/api\//g, '$1/');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    changedCount++;
  }
});

console.log(`Successfully cleaned up API paths in ${changedCount} files.`);
