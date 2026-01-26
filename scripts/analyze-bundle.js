#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * 
 * Analyzes the production build to identify large dependencies
 * and optimization opportunities.
 * 
 * Requirements: 8.4
 */

const fs = require('fs');
const path = require('path');

console.log('📦 Bundle Size Analysis\n');
console.log('='.repeat(60));

const distPath = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distPath)) {
  console.error('❌ Error: dist folder not found. Run "npm run build" first.');
  process.exit(1);
}

// Analyze assets
const assetsPath = path.join(distPath, 'assets');
if (!fs.existsSync(assetsPath)) {
  console.error('❌ Error: dist/assets folder not found.');
  process.exit(1);
}

const files = fs.readdirSync(assetsPath);
const fileStats = [];

files.forEach(file => {
  const filePath = path.join(assetsPath, file);
  const stats = fs.statSync(filePath);
  const sizeKB = (stats.size / 1024).toFixed(2);
  
  fileStats.push({
    name: file,
    size: stats.size,
    sizeKB: parseFloat(sizeKB),
    type: file.endsWith('.js') ? 'JavaScript' : 
          file.endsWith('.css') ? 'CSS' : 
          file.endsWith('.map') ? 'Source Map' : 'Other'
  });
});

// Sort by size
fileStats.sort((a, b) => b.size - a.size);

// Calculate totals
const totals = {
  js: 0,
  css: 0,
  sourceMap: 0,
  other: 0,
  total: 0
};

fileStats.forEach(file => {
  totals.total += file.size;
  if (file.type === 'JavaScript') totals.js += file.size;
  else if (file.type === 'CSS') totals.css += file.size;
  else if (file.type === 'Source Map') totals.sourceMap += file.size;
  else totals.other += file.size;
});

// Display results
console.log('\n📊 Bundle Size Summary:\n');
console.log(`Total Size: ${(totals.total / 1024).toFixed(2)} KB`);
console.log(`JavaScript: ${(totals.js / 1024).toFixed(2)} KB`);
console.log(`CSS: ${(totals.css / 1024).toFixed(2)} KB`);
if (totals.sourceMap > 0) {
  console.log(`Source Maps: ${(totals.sourceMap / 1024).toFixed(2)} KB`);
}
if (totals.other > 0) {
  console.log(`Other: ${(totals.other / 1024).toFixed(2)} KB`);
}

console.log('\n📁 Largest Files:\n');
const topFiles = fileStats.filter(f => f.type !== 'Source Map').slice(0, 10);
topFiles.forEach((file, index) => {
  const bar = '█'.repeat(Math.ceil(file.sizeKB / 10));
  console.log(`${index + 1}. ${file.name}`);
  console.log(`   ${file.sizeKB} KB ${bar}`);
  console.log('');
});

// Warnings
console.log('\n⚠️  Warnings:\n');
let hasWarnings = false;

const jsFiles = fileStats.filter(f => f.type === 'JavaScript' && f.sizeKB > 500);
if (jsFiles.length > 0) {
  hasWarnings = true;
  console.log('❗ Large JavaScript files detected (>500 KB):');
  jsFiles.forEach(file => {
    console.log(`   - ${file.name}: ${file.sizeKB} KB`);
  });
  console.log('   Consider code splitting or lazy loading.\n');
}

const totalJsKB = totals.js / 1024;
if (totalJsKB > 1000) {
  hasWarnings = true;
  console.log(`❗ Total JavaScript size is large: ${totalJsKB.toFixed(2)} KB`);
  console.log('   Consider implementing more aggressive code splitting.\n');
}

if (!hasWarnings) {
  console.log('✅ No warnings. Bundle size looks good!\n');
}

// Recommendations
console.log('💡 Optimization Recommendations:\n');
console.log('1. Use dynamic imports for route-based code splitting');
console.log('2. Lazy load heavy components (charts, editors, etc.)');
console.log('3. Remove unused dependencies from package.json');
console.log('4. Use tree-shaking friendly imports (import { x } from "lib")');
console.log('5. Consider using a bundle analyzer for detailed analysis');
console.log('   npm install --save-dev rollup-plugin-visualizer');
console.log('\n' + '='.repeat(60));
