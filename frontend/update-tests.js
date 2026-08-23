const fs = require('fs');
const path = require('path');

function findTestFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        results = results.concat(findTestFiles(filePath));
      }
    } else if (file.endsWith('.test.tsx') || file.endsWith('.test.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('app-layout') && content.includes('@/components/AppLayout')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

function removeAppLayoutMock(content) {
  const lines = content.split('\n');
  const result = [];
  let inMockBlock = false;
  let braceCount = 0;
  let mockStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!inMockBlock && line.includes("jest.mock('@/components/AppLayout'")) {
      inMockBlock = true;
      mockStartLine = i;
      braceCount = 0;
      
      // Count braces in this line
      for (const ch of line) {
        if (ch === '(') braceCount++;
        if (ch === ')') braceCount--;
      }
      
      if (braceCount <= 0) {
        inMockBlock = false;
      }
      continue;
    }
    
    if (inMockBlock) {
      for (const ch of line) {
        if (ch === '(') braceCount++;
        if (ch === ')') braceCount--;
      }
      if (braceCount <= 0) {
        inMockBlock = false;
      }
      continue;
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

function removeAppLayoutTest(content) {
  const lines = content.split('\n');
  const result = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this line starts an app-layout test
    if (line.match(/it\('renders (inside AppLayout|with correct menu)/)) {
      // Find the matching closing });
      let braceCount = 0;
      let started = false;
      let j = i;
      
      while (j < lines.length) {
        for (const ch of lines[j]) {
          if (ch === '{') { braceCount++; started = true; }
          if (ch === '}') braceCount--;
        }
        j++;
        if (started && braceCount <= 0) break;
      }
      
      i = j;
      
      // Skip extra blank line after
      if (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      continue;
    }
    
    result.push(lines[i]);
    i++;
  }
  
  return result.join('\n');
}

function updateTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Step 1: Remove AppLayout mock
  const withoutMock = removeAppLayoutMock(content);
  if (withoutMock !== content) {
    content = withoutMock;
    modified = true;
  }

  // Step 2: Remove app-layout test cases
  const withoutTest = removeAppLayoutTest(content);
  if (withoutTest !== content) {
    content = withoutTest;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

const srcDir = path.join(__dirname, 'src');
const testFiles = findTestFiles(srcDir);
console.log(`Found ${testFiles.length} test files with AppLayout references\n`);

let updatedCount = 0;
for (const file of testFiles) {
  const relPath = path.relative(__dirname, file);
  if (updateTestFile(file)) {
    console.log(`✓ Updated: ${relPath}`);
    updatedCount++;
  } else {
    console.log(`  No changes: ${relPath}`);
  }
}

console.log(`\nSummary: ${updatedCount} of ${testFiles.length} files updated`);
