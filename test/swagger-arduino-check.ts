#!/usr/bin/env tsx

import { swaggerSpec } from '../src/config/swagger';

console.log('🔍 Arduino Swagger Documentation Verification\n');

try {
  // Check if Arduino tags are present
  const tags = swaggerSpec.tags || [];
  const arduinoTags = tags.filter(tag => tag.name.toLowerCase().includes('arduino'));
  
  console.log(`📋 Arduino Tags Found: ${arduinoTags.length}`);
  arduinoTags.forEach(tag => {
    console.log(`   ✅ ${tag.name}: ${tag.description}`);
  });

  // Check if Arduino schemas are present
  const schemas = swaggerSpec.components?.schemas || {};
  const arduinoSchemas = Object.keys(schemas).filter(name => 
    name.toLowerCase().includes('arduino') || 
    ['CompileRequest', 'CompileResponse', 'JobStatusResponse'].includes(name)
  );
  
  console.log(`\n🧩 Arduino Schemas Found: ${arduinoSchemas.length}`);
  arduinoSchemas.forEach(schema => {
    console.log(`   ✅ ${schema}`);
  })

  // Check if Arduino paths are present
  const paths = swaggerSpec.paths || {};
  const arduinoPaths = Object.keys(paths).filter(path => path.includes('arduino'));
  
  console.log(`\n🛣️  Arduino Endpoints Found: ${arduinoPaths.length}`);
  arduinoPaths.forEach(path => {
    const methods = Object.keys(paths[path]);
    console.log(`   ✅ ${methods.join(', ').toUpperCase()} ${path}`);
  });

  // Check for key endpoints
  const expectedEndpoints = [
    '/api/v1/arduino/problems',
    '/api/v1/arduino/problems/{problemId}',
    '/api/v1/arduino/compile',
    '/api/v1/arduino/jobs/{submissionId}',
    '/api/v1/arduino/submissions',
    '/api/v1/arduino/admin/queue/stats'
  ];

  console.log('\n📊 Expected Endpoint Coverage:');
  expectedEndpoints.forEach(endpoint => {
    const exists = paths[endpoint] !== undefined;
    console.log(`   ${exists ? '✅' : '❌'} ${endpoint}`);
  });

  // Verify documentation completeness
  const description = swaggerSpec.info?.description || '';
  const hasArduinoDescription = description.includes('Arduino Platform');
  
  console.log(`\n📝 Documentation Updates:`);
  console.log(`   ${hasArduinoDescription ? '✅' : '❌'} Arduino Platform mentioned in main description`);

  // Summary
  const totalArduinoItems = arduinoTags.length + arduinoSchemas.length + arduinoPaths.length;
  console.log(`\n🎯 Arduino Documentation Summary:`);
  console.log(`   📋 Tags: ${arduinoTags.length}/4 expected`);
  console.log(`   🧩 Schemas: ${arduinoSchemas.length}/10+ expected`);
  console.log(`   🛣️  Endpoints: ${arduinoPaths.length}/6 expected`);
  console.log(`   📝 Description: ${hasArduinoDescription ? 'Updated' : 'Missing'}`);
  console.log(`   📊 Total Items: ${totalArduinoItems}`);

  if (totalArduinoItems >= 20) {
    console.log('\n🎉 Arduino Swagger Documentation Complete!');
    console.log('\n🚀 Access documentation at: http://localhost:5000/api-docs');
    console.log('🔗 JSON spec available at: http://localhost:5000/api-docs-json');
  } else {
    console.log('\n⚠️  Arduino documentation may be incomplete');
  }

} catch (error) {
  console.error('❌ Error checking Swagger documentation:', error);
  process.exit(1);
}

console.log('\n✅ Documentation verification complete!');