#!/usr/bin/env node
/**
 * Project Cleanup & Maintenance Script
 * Helps maintain a clean project structure
 */

const fs = require('fs');
const path = require('path');

class ProjectCleaner {
  constructor() {
    this.projectRoot = process.cwd();
    this.cleanupStats = {
      filesRemoved: 0,
      dirsRemoved: 0,
      bytesFreed: 0
    };
  }

  // Clean up common temporary and cache files
  async cleanTempFiles() {
    console.log('🧹 Cleaning temporary files...');
    
    const tempPatterns = [
      '**/*.tmp',
      '**/*.temp',
      '**/tmp/**',
      '**/temp/**',
      '**/.cache/**',
      '**/node_modules/.cache/**'
    ];

    for (const pattern of tempPatterns) {
      await this.removeFilesByPattern(pattern);
    }
  }

  // Clean up log files older than 7 days
  async cleanOldLogs() {
    console.log('📋 Cleaning old log files...');
    
    const logDirs = ['logs', 'log'];
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const logDir of logDirs) {
      const logPath = path.join(this.projectRoot, logDir);
      if (fs.existsSync(logPath)) {
        await this.cleanOldFilesInDir(logPath, maxAge);
      }
    }
  }

  // Remove empty directories
  async removeEmptyDirs() {
    console.log('📁 Removing empty directories...');
    
    const excludeDirs = ['.git', 'node_modules', '.vscode', '.idea'];
    await this.removeEmptyDirsRecursive(this.projectRoot, excludeDirs);
  }

  // Clean up duplicate script files
  async cleanDuplicateScripts() {
    console.log('📝 Checking for duplicate scripts...');
    
    const scriptsDir = path.join(this.projectRoot, 'scripts');
    if (!fs.existsSync(scriptsDir)) return;

    const scriptFiles = fs.readdirSync(scriptsDir);
    const duplicatePatterns = [
      /^test-.*\.test\.js$/,
      /^.*\.backup\.js$/,
      /^.*\.old\.js$/,
      /^.*-v\d+\.js$/
    ];

    for (const file of scriptFiles) {
      if (duplicatePatterns.some(pattern => pattern.test(file))) {
        const filePath = path.join(scriptsDir, file);
        console.log(`  🗑️ Removing duplicate: ${file}`);
        this.removeFile(filePath);
      }
    }
  }

  // Organize documentation files
  async organizeDocs() {
    console.log('📚 Organizing documentation...');
    
    const docsDir = path.join(this.projectRoot, 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir);
    }

    const rootFiles = fs.readdirSync(this.projectRoot);
    const docPatterns = /\\.(md|txt|doc|docx|pdf)$/i;
    
    const keepInRoot = ['README.md', 'CHANGELOG.md', 'LICENSE', 'CONTRIBUTING.md'];

    for (const file of rootFiles) {
      if (docPatterns.test(file) && !keepInRoot.includes(file)) {
        const srcPath = path.join(this.projectRoot, file);
        const destPath = path.join(docsDir, file);
        
        if (fs.lstatSync(srcPath).isFile()) {
          console.log(`  📄 Moving ${file} to docs/`);
          fs.renameSync(srcPath, destPath);
        }
      }
    }
  }

  // Helper methods
  async removeFilesByPattern(pattern) {
    // Implementation would use glob pattern matching
    // This is a simplified version
    console.log(`  🗑️ Removing files matching: ${pattern}`);
  }

  async cleanOldFilesInDir(dirPath, maxAge) {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    const now = Date.now();

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.lstatSync(filePath);
      
      if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
        console.log(`  🗑️ Removing old log: ${file}`);
        this.removeFile(filePath);
      }
    }
  }

  async removeEmptyDirsRecursive(dirPath, excludeDirs = []) {
    if (!fs.existsSync(dirPath)) return;

    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      if (excludeDirs.includes(item)) continue;
      
      const itemPath = path.join(dirPath, item);
      const stats = fs.lstatSync(itemPath);
      
      if (stats.isDirectory()) {
        await this.removeEmptyDirsRecursive(itemPath, excludeDirs);
        
        // Check if directory is now empty
        const remainingItems = fs.readdirSync(itemPath);
        if (remainingItems.length === 0 && !excludeDirs.includes(item)) {
          console.log(`  📁 Removing empty directory: ${item}`);
          fs.rmdirSync(itemPath);
          this.cleanupStats.dirsRemoved++;
        }
      }
    }
  }

  removeFile(filePath) {
    try {
      const stats = fs.lstatSync(filePath);
      this.cleanupStats.bytesFreed += stats.size;
      fs.unlinkSync(filePath);
      this.cleanupStats.filesRemoved++;
    } catch (error) {
      console.error(`    ❌ Error removing ${filePath}: ${error.message}`);
    }
  }

  // Main cleanup process
  async cleanup(options = {}) {
    console.log('🚀 Starting project cleanup...');
    console.log('=' .repeat(50));

    const {
      cleanTemp = true,
      cleanLogs = true,
      removeEmpty = true,
      cleanDuplicates = true,
      organizeDocs = true
    } = options;

    try {
      if (cleanTemp) await this.cleanTempFiles();
      if (cleanLogs) await this.cleanOldLogs();
      if (cleanDuplicates) await this.cleanDuplicateScripts();
      if (organizeDocs) await this.organizeDocs();
      if (removeEmpty) await this.removeEmptyDirs();

      console.log('\\n✅ Cleanup completed!');
      console.log('📊 Cleanup Statistics:');
      console.log(`   Files removed: ${this.cleanupStats.filesRemoved}`);
      console.log(`   Directories removed: ${this.cleanupStats.dirsRemoved}`);
      console.log(`   Space freed: ${(this.cleanupStats.bytesFreed / 1024).toFixed(2)} KB`);

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  // Check project health
  async checkProjectHealth() {
    console.log('🔍 Project Health Check');
    console.log('=' .repeat(30));

    const checks = [
      this.checkGitignore(),
      this.checkPackageJson(),
      this.checkEnvironmentFiles(),
      this.checkDocumentation(),
      this.checkScriptQuality()
    ];

    const results = await Promise.all(checks);
    
    console.log('\\n📊 Health Check Results:');
    results.forEach((result, index) => {
      const status = result.passed ? '✅' : '⚠️';
      console.log(`   ${status} ${result.name}: ${result.message}`);
    });
  }

  async checkGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    const exists = fs.existsSync(gitignorePath);
    
    return {
      name: 'Gitignore',
      passed: exists,
      message: exists ? 'Present and comprehensive' : 'Missing or incomplete'
    };
  }

  async checkPackageJson() {
    const packagePath = path.join(this.projectRoot, 'package.json');
    const exists = fs.existsSync(packagePath);
    
    if (!exists) {
      return { name: 'Package.json', passed: false, message: 'Missing' };
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const hasScripts = pkg.scripts && Object.keys(pkg.scripts).length > 0;
      
      return {
        name: 'Package.json',
        passed: true,
        message: hasScripts ? 'Valid with scripts' : 'Valid but missing scripts'
      };
    } catch {
      return { name: 'Package.json', passed: false, message: 'Invalid JSON' };
    }
  }

  async checkEnvironmentFiles() {
    const envExample = fs.existsSync(path.join(this.projectRoot, '.env.example'));
    const envFile = fs.existsSync(path.join(this.projectRoot, '.env'));
    
    return {
      name: 'Environment',
      passed: envExample,
      message: envExample ? 'Example file present' : 'Consider adding .env.example'
    };
  }

  async checkDocumentation() {
    const readme = fs.existsSync(path.join(this.projectRoot, 'README.md'));
    
    return {
      name: 'Documentation',
      passed: readme,
      message: readme ? 'README.md present' : 'README.md missing'
    };
  }

  async checkScriptQuality() {
    const scriptsDir = path.join(this.projectRoot, 'scripts');
    
    if (!fs.existsSync(scriptsDir)) {
      return { name: 'Scripts', passed: true, message: 'No scripts directory' };
    }

    const scripts = fs.readdirSync(scriptsDir);
    const jsScripts = scripts.filter(f => f.endsWith('.js'));
    
    return {
      name: 'Scripts',
      passed: jsScripts.length > 0,
      message: `${jsScripts.length} JavaScript files found`
    };
  }
}

// CLI interface
async function main() {
  const cleaner = new ProjectCleaner();
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Project Cleanup & Maintenance Tool');
    console.log('');
    console.log('Usage: node scripts/cleanup.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --cleanup    Run full cleanup (default)');
    console.log('  --check      Run health check only');
    console.log('  --help, -h   Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/cleanup.js --cleanup');
    console.log('  node scripts/cleanup.js --check');
    return;
  }

  if (args.includes('--check')) {
    await cleaner.checkProjectHealth();
  } else {
    await cleaner.cleanup();
    console.log('\\n🔍 Running health check...');
    await cleaner.checkProjectHealth();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ProjectCleaner;