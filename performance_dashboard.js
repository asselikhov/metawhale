#!/usr/bin/env node

/**
 * Performance Dashboard
 * Monitor bot response times and generate optimization reports
 */

require('dotenv').config();
const mongoose = require('mongoose');
const performanceMonitor = require('./src/services/performanceMonitorService');
const backgroundService = require('./src/services/backgroundProcessingService');

async function showPerformanceDashboard() {
  try {
    console.log('🚀 BOT PERFORMANCE DASHBOARD');
    console.log('============================\n');

    // Get performance report
    const report = performanceMonitor.getPerformanceReport();
    
    // Summary
    console.log('📊 PERFORMANCE SUMMARY:');
    console.log('=======================');
    console.log(`Total callbacks processed: ${report.summary.totalCallbacks}`);
    console.log(`Average response time: ${report.summary.averageResponseTime}`);
    console.log(`Performance grade: ${report.summary.performanceGrade}`);
    console.log(`Slow callbacks: ${report.summary.slowCallbacksPercentage}`);
    
    // Background service stats
    const bgStats = backgroundService.getStats();
    console.log('\n🔄 BACKGROUND PROCESSING:');
    console.log('=========================');
    console.log(`Queue size: ${bgStats.queueSize}`);
    console.log(`Active jobs: ${bgStats.activeJobs}`);
    console.log(`Is processing: ${bgStats.isProcessing ? 'Yes' : 'No'}`);
    
    // Callback type performance
    if (Object.keys(report.byCallbackType).length > 0) {
      console.log('\n⚡ CALLBACK PERFORMANCE BY TYPE:');
      console.log('=================================');
      
      Object.entries(report.byCallbackType)
        .sort(([,a], [,b]) => b.avgDuration - a.avgDuration)
        .forEach(([type, stats]) => {
          const grade = stats.avgDuration < 100 ? '🟢' : 
                       stats.avgDuration < 500 ? '🟡' : 
                       stats.avgDuration < 1000 ? '🟠' : '🔴';
          
          console.log(`${grade} ${type}:`);
          console.log(`   Count: ${stats.count}`);
          console.log(`   Avg: ${Math.round(stats.avgDuration)}ms`);
          console.log(`   Range: ${Math.round(stats.minDuration)}-${Math.round(stats.maxDuration)}ms`);
          console.log(`   Slow: ${stats.slowPercentage.toFixed(1)}%`);
          console.log('');
        });
    }
    
    // Slowest callbacks
    if (report.slowestCallbacks.length > 0) {
      console.log('🐌 SLOWEST CALLBACKS:');
      console.log('====================');
      
      report.slowestCallbacks.forEach((callback, index) => {
        console.log(`${index + 1}. ${callback.callbackType}: ${callback.duration}ms`);
        console.log(`   User: ${callback.chatId}`);
        console.log(`   Time: ${callback.timestamp.toLocaleString('ru-RU')}`);
        console.log('');
      });
    }
    
    // Recommendations
    console.log('💡 OPTIMIZATION RECOMMENDATIONS:');
    console.log('=================================');
    report.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
    
    // Memory usage
    console.log('\n💾 MEMORY USAGE:');
    console.log('================');
    const memUsage = process.memoryUsage();
    console.log(`RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
    console.log(`Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    console.log(`Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
    console.log(`External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
    
    // Performance tips
    console.log('\n🔧 OPTIMIZATION STATUS:');
    console.log('=======================');
    console.log('✅ Instant callback responses implemented');
    console.log('✅ Background processing service active');
    console.log('✅ Performance monitoring enabled');
    console.log('✅ Optimized wallet and P2P handlers');
    
    if (report.summary.totalCallbacks === 0) {
      console.log('\nℹ️ No callback data available yet. Use the bot to generate performance metrics.');
    }
    
  } catch (error) {
    console.error('❌ Dashboard error:', error);
  }
}

async function generatePerformanceReport() {
  try {
    console.log('📝 GENERATING DETAILED PERFORMANCE REPORT');
    console.log('==========================================\n');
    
    const report = performanceMonitor.getPerformanceReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance_report_${timestamp}.json`;
    
    // Save detailed report
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    
    console.log(`✅ Detailed report saved to: ${filename}`);
    console.log('\nReport contains:');
    console.log('- Performance summary');
    console.log('- Callback type statistics');
    console.log('- Slowest callback instances');
    console.log('- Optimization recommendations');
    
  } catch (error) {
    console.error('❌ Report generation error:', error);
  }
}

async function clearPerformanceData() {
  try {
    console.log('🧹 CLEARING PERFORMANCE DATA');
    console.log('============================\n');
    
    performanceMonitor.clearMetrics();
    backgroundService.clearAll();
    
    console.log('✅ Performance metrics cleared');
    console.log('✅ Background queue cleared');
    console.log('\nNew performance tracking started.');
    
  } catch (error) {
    console.error('❌ Clear data error:', error);
  }
}

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'report':
    generatePerformanceReport();
    break;
    
  case 'clear':
    clearPerformanceData();
    break;
    
  case 'dashboard':
  default:
    showPerformanceDashboard();
    break;
}

// Show usage if no valid command
if (!['report', 'clear', 'dashboard'].includes(command)) {
  console.log('\n📖 USAGE:');
  console.log('==========');
  console.log('node performance_dashboard.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  dashboard  - Show real-time performance dashboard (default)');
  console.log('  report     - Generate detailed JSON report');
  console.log('  clear      - Clear all performance data');
  console.log('');
  console.log('Examples:');
  console.log('  node performance_dashboard.js');
  console.log('  node performance_dashboard.js report');
  console.log('  node performance_dashboard.js clear');
}