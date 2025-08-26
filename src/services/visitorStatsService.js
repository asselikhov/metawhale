/**
 * Visitor Statistics Service
 * Generates Excel reports with monthly visitor statistics for admin
 */

const ExcelJS = require('exceljs');
const { User } = require('../database/models');
const path = require('path');
const fs = require('fs').promises;

class VisitorStatsService {
  constructor() {
    this.tempDir = path.join(__dirname, '..', '..', 'temp');
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch (error) {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Get visitors for the current month
   * @returns {Array} Array of user data for current month
   */
  async getMonthlyVisitors() {
    try {
      console.log('📊 Collecting monthly visitor statistics...');

      // Calculate current month start and end dates
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      console.log(`📅 Collecting visitors from ${monthStart.toLocaleDateString('ru-RU')} to ${monthEnd.toLocaleDateString('ru-RU')}`);

      // Find users who subscribed or were active this month
      const visitors = await User.find({
        $or: [
          { subscribedAt: { $gte: monthStart, $lte: monthEnd } },
          { lastOnline: { $gte: monthStart, $lte: monthEnd } }
        ]
      }).sort({ subscribedAt: -1, lastOnline: -1 });

      console.log(`👥 Found ${visitors.length} visitors for current month`);

      return visitors.map(user => ({
        userId: user.chatId,
        username: user.username || 'Не указан',
        firstName: user.firstName || 'Не указано',
        lastName: user.lastName || '',
        subscribedAt: user.subscribedAt,
        lastOnline: user.lastOnline || user.subscribedAt,
        fullName: this.buildFullName(user)
      }));

    } catch (error) {
      console.error('Error getting monthly visitors:', error);
      throw error;
    }
  }

  /**
   * Build full name from user data
   * @param {Object} user User object
   * @returns {String} Full name
   */
  buildFullName(user) {
    const parts = [];
    if (user.firstName && user.firstName !== 'Не указано') {
      parts.push(user.firstName);
    }
    if (user.lastName && user.lastName.trim()) {
      parts.push(user.lastName);
    }
    
    return parts.length > 0 ? parts.join(' ') : 'Не указано';
  }

  /**
   * Format date for Excel display
   * @param {Date} date Date to format
   * @returns {String} Formatted date string
   */
  formatDateForExcel(date) {
    if (!date) return 'Не указано';
    
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Moscow'
    };
    
    return date.toLocaleString('ru-RU', options);
  }

  /**
   * Generate Excel file with visitor statistics
   * @returns {String} Path to generated Excel file
   */
  async generateExcelReport() {
    try {
      console.log('📊 Generating Excel report...');
      
      await this.ensureTempDir();
      
      // Get visitor data
      const visitors = await this.getMonthlyVisitors();
      
      // Create workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Посетители за месяц', {
        properties: {
          defaultRowHeight: 20,
          defaultColWidth: 15
        }
      });

      // Configure column widths for better readability
      worksheet.columns = [
        { header: 'ID Пользователя', key: 'userId', width: 15 },
        { header: 'Username', key: 'username', width: 20 },
        { header: 'Имя', key: 'fullName', width: 25 },
        { header: 'Дата посещения', key: 'visitDate', width: 20 },
        { header: 'Последняя активность', key: 'lastActivity', width: 20 }
      ];

      // Style the header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Add data rows
      visitors.forEach((visitor, index) => {
        const row = worksheet.addRow({
          userId: visitor.userId,
          username: visitor.username,
          fullName: visitor.fullName,
          visitDate: this.formatDateForExcel(visitor.subscribedAt),
          lastActivity: this.formatDateForExcel(visitor.lastOnline)
        });

        // Style data rows with alternating colors
        const isEvenRow = (index + 2) % 2 === 0;
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEvenRow ? 'F2F2F2' : 'FFFFFF' }
        };

        // Add borders to all cells
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', wrapText: true };
        });

        // Special formatting for ID column (center alignment)
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      });

      // Add summary information at the bottom
      const summaryRowIndex = visitors.length + 3;
      const summaryRow = worksheet.getRow(summaryRowIndex);
      summaryRow.getCell(1).value = 'Итого посетителей:';
      summaryRow.getCell(2).value = visitors.length;
      summaryRow.font = { bold: true };
      summaryRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E7F3FF' }
      };

      // Add report generation date
      const dateRowIndex = summaryRowIndex + 1;
      const dateRow = worksheet.getRow(dateRowIndex);
      dateRow.getCell(1).value = 'Отчет сгенерирован:';
      dateRow.getCell(2).value = this.formatDateForExcel(new Date());
      dateRow.font = { italic: true };

      // Auto-fit content (ensure text fits)
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          // Ensure minimum height for readability
          if (row.height < 20) {
            row.height = 20;
          }
        });
      });

      // Generate filename with current month
      const now = new Date();
      const monthName = now.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
      const fileName = `visitor_stats_${monthName.replace(' ', '_')}_${now.getTime()}.xlsx`;
      const filePath = path.join(this.tempDir, fileName);

      // Save the Excel file
      await workbook.xlsx.writeFile(filePath);
      
      console.log(`✅ Excel report generated: ${fileName}`);
      console.log(`📊 Total visitors included: ${visitors.length}`);
      
      return filePath;

    } catch (error) {
      console.error('Error generating Excel report:', error);
      throw error;
    }
  }

  /**
   * Clean up old temporary files
   */
  async cleanupOldFiles() {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      for (const file of files) {
        if (file.endsWith('.xlsx')) {
          const filePath = path.join(this.tempDir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtimeMs > maxAge) {
            await fs.unlink(filePath);
            console.log(`🗑️ Cleaned up old file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.log('Note: Could not clean up old files:', error.message);
    }
  }

  /**
   * Generate visitor statistics summary for logging
   * @returns {Object} Statistics summary
   */
  async getVisitorStatsSummary() {
    try {
      const visitors = await this.getMonthlyVisitors();
      
      // Calculate statistics
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentVisitors = visitors.filter(v => v.lastOnline > weekAgo);
      const todayVisitors = visitors.filter(v => v.lastOnline > dayAgo);
      const newSubscribers = visitors.filter(v => v.subscribedAt > weekAgo);

      return {
        totalMonthlyVisitors: visitors.length,
        recentlyActive: recentVisitors.length,
        todayActive: todayVisitors.length,
        newThisWeek: newSubscribers.length,
        monthYear: now.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })
      };

    } catch (error) {
      console.error('Error getting visitor stats summary:', error);
      return {
        totalMonthlyVisitors: 0,
        recentlyActive: 0,
        todayActive: 0,
        newThisWeek: 0,
        monthYear: 'Неизвестно',
        error: error.message
      };
    }
  }
}

module.exports = new VisitorStatsService();