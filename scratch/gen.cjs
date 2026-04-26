const fs = require('fs');
const path = require('path');

const fileToBaseMap = {
  'src/modules/auth/auth.routes.ts': '/api/v1/auth',
  'src/modules/routes/common.ts': '/api/v1',
  'src/modules/routes/admin.ts': '/api/v1/admin',
  'src/modules/routes/student.ts': '/api/v1/student',
  'src/modules/routes/student/practice.ts': '/api/v1/student/practice',
  'src/modules/routes/student/contest.ts': '/api/v1/student/contest',
  'src/modules/routes/problem.ts': '/api/v1/problems',
  'src/modules/routes/submission.ts': '/api/v1/submissions',
  'src/modules/routes/judge0.ts': '/api/v1/judge0',
  'src/modules/routes/student/potd.ts': '/api/v1/student/potd',
  'src/modules/routes/public.ts': '/api/public/tests',
  'src/modules/routes/product-admin.ts': '/api/product-admin',
  'src/modules/product-admin/auth.routes.ts': '/api/product-admin/auth',
  'src/modules/product-admin/colleges.routes.ts': '/api/product-admin/colleges',
  'src/modules/product-admin/rbac.routes.ts': '/api/product-admin/rbac',
  'src/modules/product-admin/hackathon.routes.ts': '/api/product-admin/hackathons',
  'src/modules/product-admin/dashboard.routes.ts': '/api/product-admin/dashboard',
  'src/modules/product-admin/users.routes.ts': '/api/product-admin/users'
};

const regex = /router\.(get|post|put|delete|patch)\((['"`])([^'"`]+)\2/g;

let swaggerDocs = `/**\n * @openapi\n`;

const knownTags = {
  '/api/product-admin': 'Product Admin',
  '/api/v1/auth': 'Authentication',
  '/api/v1/admin': 'Admin',
  '/api/v1/student': 'Student',
  '/api/v1/problems': 'Problems',
  '/api/v1/submissions': 'Submissions',
  '/api/v1/judge0': 'Judge0',
  '/api/public/tests': 'Public APIs - Tests'
};

function getTag(basePath) {
  for (const [key, tag] of Object.entries(knownTags)) {
    if (basePath.startsWith(key)) return tag;
  }
  return 'Other APIs';
}

for (const [file, basePath] of Object.entries(fileToBaseMap)) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.warn("File not found:", fullPath);
    continue;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  let match;
  
  // We'll group by path
  const paths = {};
  
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toLowerCase();
    let route = match[3];
    
    // Normalize path
    let fullRoute = basePath;
    if (route !== '/') {
      fullRoute += route.startsWith('/') ? route : '/' + route;
    }
    
    // Convert express /:param to swagger /{param}
    fullRoute = fullRoute.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    
    if (!paths[fullRoute]) paths[fullRoute] = {};
    
    // Extract parameters
    const params = [];
    const paramMatches = fullRoute.match(/\{([^}]+)\}/g);
    if (paramMatches) {
      for (const p of paramMatches) {
        params.push(p.slice(1, -1));
      }
    }
    
    paths[fullRoute][method] = {
      tag: getTag(basePath),
      summary: `${method.toUpperCase()} ${fullRoute}`,
      params
    };
  }
  
  for (const [route, methods] of Object.entries(paths)) {
    swaggerDocs += ` * ${route}:\n`;
    for (const [method, details] of Object.entries(methods)) {
      swaggerDocs += ` *   ${method}:\n`;
      swaggerDocs += ` *     tags: [${details.tag}]\n`;
      swaggerDocs += ` *     summary: ${details.summary}\n`;
      swaggerDocs += ` *     security:\n *       - cookieAuth: []\n *       - bearerAuth: []\n`;
      
      if (details.params.length > 0) {
        swaggerDocs += ` *     parameters:\n`;
        for (const p of details.params) {
          swaggerDocs += ` *       - in: path\n`;
          swaggerDocs += ` *         name: ${p}\n`;
          swaggerDocs += ` *         required: true\n`;
          swaggerDocs += ` *         schema:\n`;
          swaggerDocs += ` *           type: string\n`;
        }
      }
      
      if (['post', 'put', 'patch'].includes(method)) {
        swaggerDocs += ` *     requestBody:\n`;
        swaggerDocs += ` *       content:\n`;
        swaggerDocs += ` *         application/json:\n`;
        swaggerDocs += ` *           schema:\n`;
        swaggerDocs += ` *             type: object\n`;
      }
      
      swaggerDocs += ` *     responses:\n`;
      swaggerDocs += ` *       "200":\n`;
      swaggerDocs += ` *         description: Successful operation\n`;
    }
  }
}

swaggerDocs += ` */\n`;

fs.writeFileSync(path.join(process.cwd(), 'src/config/swagger-extensions.ts'), swaggerDocs);
console.log('Done!');
