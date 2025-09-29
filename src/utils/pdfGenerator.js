import jsPDF from 'jspdf';

// Currency helpers
const currencySymbols = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CAD: "$",
  AUD: "$",
  ZAR: "R",
  GHS: "GH₵",
  KES: "KSh",
  INR: "₹",
  CNY: "¥"
};

function getCurrencySymbol(code) {
  return currencySymbols[code] || code;
}

const currenciesWithDecimals = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR", "GHS", "KES", "INR", "CNY"];
function formatPrice(price, currency) {
  if (currenciesWithDecimals.includes(currency)) {
    return Number(price).toFixed(2);
  }
  return price;
}

// Generate a comprehensive monthly analytics PDF report
export const generateMonthlyAnalyticsPDF = async (storeData, analyticsData, period = 'monthly') => {
  try {
    // Create new PDF document
    const pdf = new jsPDF('p', 'mm', 'a4');
    const margin = 20;
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const contentWidth = pageWidth - (margin * 2);
    
    let yPosition = margin;
    
    // Helper function to add new page if needed
    const checkPageBreak = (requiredHeight) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };
    
    // Helper function to add text with automatic line breaks
    const addText = (text, x, y, options = {}) => {
      const fontSize = options.fontSize || 10;
      const maxWidth = options.maxWidth || contentWidth;
      const lineHeight = options.lineHeight || fontSize * 0.35;
      
      pdf.setFontSize(fontSize);
      if (options.color) {
        pdf.setTextColor(options.color);
      } else {
        pdf.setTextColor(0, 0, 0);
      }
      
      const lines = pdf.splitTextToSize(text, maxWidth);
      lines.forEach((line, index) => {
        pdf.text(line, x, y + (index * lineHeight));
      });
      
      return y + (lines.length * lineHeight);
    };
    
    // Title and Header
    pdf.setFillColor(0, 123, 127);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.text('Store Analytics Report', margin, 25);
    
    pdf.setFontSize(14);
    const currentDate = new Date().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const periodText = period === 'monthly' ? 'Monthly Report' : 
                     period === '30days' ? 'Last 30 Days' :
                     period === '7days' ? 'Last 7 Days' : 
                     'Analytics Report';
    
    pdf.text(`${periodText} - Generated on ${currentDate}`, margin, 35);
    
    yPosition = 50;
    
    // Store Information Section
    pdf.setTextColor(0, 123, 127);
    pdf.setFontSize(18);
    pdf.text('Store Information', margin, yPosition);
    yPosition += 10;
    
    pdf.setDrawColor(0, 123, 127);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(12);
    yPosition = addText(`Store Name: ${storeData.storeName || 'N/A'}`, margin, yPosition, {fontSize: 12});
    yPosition += 2;
    yPosition = addText(`Location: ${storeData.storeLocation || storeData.storeAddress || 'N/A'}`, margin, yPosition, {fontSize: 12});
    yPosition += 2;
    yPosition = addText(`Category: ${storeData.category || 'N/A'}`, margin, yPosition, {fontSize: 12});
    yPosition += 2;
    yPosition = addText(`Currency: ${storeData.currency || 'GBP'}`, margin, yPosition, {fontSize: 12});
    yPosition += 15;
    
    // Key Metrics Section
    checkPageBreak(80);
    
    pdf.setTextColor(0, 123, 127);
    pdf.setFontSize(18);
    pdf.text('Key Performance Metrics', margin, yPosition);
    yPosition += 10;
    
    pdf.setDrawColor(0, 123, 127);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;
    
    // Create metrics cards layout
    const cardWidth = (contentWidth - 20) / 3;
    const cardHeight = 40;
    
    // Total Views Card
    pdf.setFillColor(102, 126, 234);
    pdf.rect(margin, yPosition, cardWidth, cardHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.text(analyticsData.totalViews.toLocaleString(), margin + 5, yPosition + 15);
    pdf.setFontSize(12);
    pdf.text('Total Views', margin + 5, yPosition + 25);
    pdf.text('👁️', margin + 5, yPosition + 35);
    
    // Total Orders Card
    pdf.setFillColor(240, 147, 251);
    pdf.rect(margin + cardWidth + 10, yPosition, cardWidth, cardHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.text(analyticsData.totalOrders.toLocaleString(), margin + cardWidth + 15, yPosition + 15);
    pdf.setFontSize(12);
    pdf.text('Total Orders', margin + cardWidth + 15, yPosition + 25);
    pdf.text('🛍️', margin + cardWidth + 15, yPosition + 35);
    
    // Total Revenue Card
    pdf.setFillColor(79, 172, 254);
    pdf.rect(margin + (cardWidth + 10) * 2, yPosition, cardWidth, cardHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    const currency = storeData.currency || 'GBP';
    pdf.text(`${getCurrencySymbol(currency)}${formatPrice(analyticsData.totalRevenue, currency)}`, 
             margin + (cardWidth + 10) * 2 + 5, yPosition + 15);
    pdf.setFontSize(12);
    pdf.text('Total Revenue', margin + (cardWidth + 10) * 2 + 5, yPosition + 25);
    pdf.text('💰', margin + (cardWidth + 10) * 2 + 5, yPosition + 35);
    
    yPosition += cardHeight + 20;
    
    // Additional metrics if available
    if (analyticsData.boostAnalytics && analyticsData.boostAnalytics.isActive) {
      checkPageBreak(30);
      
      pdf.setTextColor(0, 123, 127);
      pdf.setFontSize(16);
      pdf.text('Boost Performance', margin, yPosition);
      yPosition += 8;
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      yPosition = addText(`Boost Status: Active (${analyticsData.boostAnalytics.daysRemaining} days remaining)`, margin, yPosition);
      yPosition += 2;
      yPosition = addText(`Boost Views: ${analyticsData.boostAnalytics.views.toLocaleString()}`, margin, yPosition);
      yPosition += 15;
    }
    
    // Top Products Section
    if (analyticsData.topProducts && analyticsData.topProducts.length > 0) {
      checkPageBreak(100);
      
      pdf.setTextColor(0, 123, 127);
      pdf.setFontSize(18);
      pdf.text('Top Selling Products', margin, yPosition);
      yPosition += 10;
      
      pdf.setDrawColor(0, 123, 127);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
      
      // Table header
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition, contentWidth, 8, 'F');
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      pdf.text('Rank', margin + 2, yPosition + 5);
      pdf.text('Product Name', margin + 20, yPosition + 5);
      pdf.text('Sold', margin + 100, yPosition + 5);
      pdf.text('Revenue', margin + 130, yPosition + 5);
      
      yPosition += 8;
      
      // Table rows
      analyticsData.topProducts.slice(0, 10).forEach((product, index) => {
        checkPageBreak(8);
        
        if (index % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPosition, contentWidth, 6, 'F');
        }
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.text(`#${index + 1}`, margin + 2, yPosition + 4);
        
        const productName = product.name.length > 35 ? product.name.substring(0, 32) + '...' : product.name;
        pdf.text(productName, margin + 20, yPosition + 4);
        pdf.text(product.totalSold.toString(), margin + 100, yPosition + 4);
        pdf.text(`${getCurrencySymbol(currency)}${formatPrice(product.revenue, currency)}`, margin + 130, yPosition + 4);
        
        yPosition += 6;
      });
      
      yPosition += 10;
    }
    
    // Customer Analytics Section
    if (analyticsData.customerAnalytics && analyticsData.customerAnalytics.length > 0) {
      checkPageBreak(60);
      
      pdf.setTextColor(0, 123, 127);
      pdf.setFontSize(18);
      pdf.text('Customer Insights', margin, yPosition);
      yPosition += 10;
      
      pdf.setDrawColor(0, 123, 127);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
      
      const uniqueCustomers = new Set(analyticsData.customerAnalytics.map(c => c.buyerId)).size;
      const averageOrderValue = analyticsData.totalRevenue / analyticsData.totalOrders || 0;
      const repeatCustomers = analyticsData.customerAnalytics.reduce((acc, curr, index, arr) => {
        const duplicates = arr.filter(c => c.buyerId === curr.buyerId);
        return duplicates.length > 1 ? acc + 1 : acc;
      }, 0);
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(12);
      yPosition = addText(`Total Unique Customers: ${uniqueCustomers}`, margin, yPosition);
      yPosition += 4;
      yPosition = addText(`Average Order Value: ${getCurrencySymbol(currency)}${formatPrice(averageOrderValue, currency)}`, margin, yPosition);
      yPosition += 4;
      yPosition = addText(`Repeat Customers: ${repeatCustomers}`, margin, yPosition);
      yPosition += 15;
    }
    
    // Daily Views Chart Section (if we have data)
    if (analyticsData.dailyViews && analyticsData.dailyViews.length > 0) {
      checkPageBreak(120);
      
      pdf.setTextColor(0, 123, 127);
      pdf.setFontSize(18);
      pdf.text('Daily Views Trend', margin, yPosition);
      yPosition += 10;
      
      pdf.setDrawColor(0, 123, 127);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
      
      // Create a simple bar chart representation
      const chartHeight = 80;
      const chartWidth = contentWidth;
      const maxViews = Math.max(...analyticsData.dailyViews.map(d => d.views));
      const barWidth = chartWidth / analyticsData.dailyViews.length;
      
      // Chart background
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, yPosition, chartWidth, chartHeight, 'F');
      
      // Draw bars
      analyticsData.dailyViews.forEach((day, index) => {
        const barHeight = maxViews > 0 ? (day.views / maxViews) * (chartHeight - 20) : 0;
        const x = margin + (index * barWidth) + (barWidth * 0.1);
        const y = yPosition + chartHeight - 10 - barHeight;
        
        pdf.setFillColor(0, 123, 127);
        pdf.rect(x, y, barWidth * 0.8, barHeight, 'F');
        
        // Date labels (rotated)
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(7);
        const date = new Date(day.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
        pdf.text(date, x + (barWidth * 0.4), yPosition + chartHeight - 2, null, 45);
      });
      
      // Y-axis labels
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(8);
      pdf.text('0', margin - 5, yPosition + chartHeight - 10);
      pdf.text(maxViews.toString(), margin - 5, yPosition + 5);
      
      yPosition += chartHeight + 20;
    }
    
    // Footer with generation info
    const footerY = pageHeight - 15;
    pdf.setTextColor(150, 150, 150);
    pdf.setFontSize(8);
    pdf.text(`Generated by Lokal Analytics on ${currentDate}`, margin, footerY);
    pdf.text(`Page 1 of ${pdf.internal.getNumberOfPages()}`, pageWidth - margin - 20, footerY);
    
    // Generate filename
    const monthYear = new Date().toLocaleDateString('en-GB', { 
      year: 'numeric', 
      month: '2-digit' 
    }).replace('/', '-');
    
    const filename = `${storeData.storeName || 'Store'}_Analytics_${monthYear}.pdf`;
    
    // Save the PDF
    pdf.save(filename);
    
    return {
      success: true,
      filename: filename,
      message: 'Monthly analytics report generated successfully!'
    };
    
  } catch (error) {
    console.error('Error generating PDF report:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to generate PDF report. Please try again.'
    };
  }
};

// Function to automatically generate monthly reports
export const scheduleMonthlyReport = (storeData, analyticsData) => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const timeUntilNextMonth = nextMonth.getTime() - now.getTime();
  
  // Schedule the first report for the beginning of next month
  setTimeout(() => {
    generateMonthlyAnalyticsPDF(storeData, analyticsData, 'monthly');
    
    // Then schedule monthly recurring reports
    setInterval(() => {
      generateMonthlyAnalyticsPDF(storeData, analyticsData, 'monthly');
    }, 30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds
    
  }, timeUntilNextMonth);
};

// Function to generate report for a specific date range
export const generateCustomRangePDF = async (storeData, analyticsData, startDate, endDate) => {
  const start = new Date(startDate).toLocaleDateString('en-GB');
  const end = new Date(endDate).toLocaleDateString('en-GB');
  
  return await generateMonthlyAnalyticsPDF(
    storeData, 
    analyticsData, 
    `Custom Range (${start} - ${end})`
  );
};