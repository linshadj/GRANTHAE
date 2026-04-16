const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'controller');

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already imported
  if (content.includes('STATUS_CODES')) return;

  let modified = content
    .replace(/res\.status\(200\)/g, 'res.status(STATUS_CODES.OK)')
    .replace(/res\.status\(400\)/g, 'res.status(STATUS_CODES.BAD_REQUEST)')
    .replace(/res\.status\(403\)/g, 'res.status(STATUS_CODES.FORBIDDEN)')
    .replace(/res\.status\(404\)/g, 'res.status(STATUS_CODES.NOT_FOUND)')
    .replace(/res\.status\(500\)/g, 'res.status(STATUS_CODES.INTERNAL_SERVER_ERROR)')
    // Also handle fallback patterns we added
    .replace(/error\.status\s*\|\|\s*400/g, 'error.status || STATUS_CODES.BAD_REQUEST')
    .replace(/error\.status\s*\|\|\s*500/g, 'error.status || STATUS_CODES.INTERNAL_SERVER_ERROR');

  if (modified !== content) {
    // Add import statement at the top (after other imports)
    const importStr = "import { STATUS_CODES } from \"../../utils/statusCodes.js\";\n";
    // Find the last import line
    const importRegex = /^import .+;?$/mg;
    let match;
    let lastImportIndex = -1;
    while ((match = importRegex.exec(modified)) !== null) {
        lastImportIndex = match.index + match[0].length;
    }

    if (lastImportIndex !== -1) {
        modified = modified.slice(0, lastImportIndex) + '\n' + importStr + modified.slice(lastImportIndex);
    } else {
        modified = importStr + modified;
    }
    
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.js')) {
            updateFile(fullPath);
        }
    }
}

traverseDir(controllersDir);
