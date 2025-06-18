/**
 * Report Preview Page Handler
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get report ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let reportId = urlParams.get('id');
    
    // If no ID in query param, check if it's in the path instead
    // This handles both old-style ?id=report.json and new-style /report_preview/report.json 
    if (!reportId) {
        const pathParts = window.location.pathname.split('/');
        reportId = pathParts[pathParts.length - 1];
    }
    
    // Check if the page is in dark mode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (!reportId) {
        showError('No report ID specified');
        return;
    }
    
    // Set the title of the page to include the report name
    document.title = `Report Preview: ${reportId}`;
    
    // Load report data
    loadReport(reportId);
    
    // Set up button handlers
    document.getElementById('printReport').addEventListener('click', function() {
        window.print();
    });
    
    document.getElementById('downloadReport').addEventListener('click', function() {
        downloadReport(reportId);
    });
});

/**
 * Load report data from server
 */
function loadReport(reportId) {
    // In a real application, we get the data from the server
    fetch(`/preview_report/${encodeURIComponent(reportId)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            // Get file extension to help determine the format
            const fileExt = reportId.split('.').pop().toLowerCase();
            const contentType = response.headers.get('content-type');
            
            // Handle different content types
            if ((contentType && contentType.includes('application/json')) || fileExt === 'json') {
                return response.text().then(text => {
                    try {
                        // Parse and stringify with indentation for proper formatting
                        const data = JSON.parse(text);
                        return { 
                            data: data, 
                            text: JSON.stringify(data, null, 2),
                            type: 'json' 
                        };
                    } catch (e) {
                        console.error("Error parsing JSON:", e);
                        return { data: null, text: text, type: 'text' };
                    }
                });
            } else if ((contentType && contentType.includes('text/html')) || fileExt === 'html') {
                return response.text().then(text => {
                    return { data: null, text: text, type: 'html' };
                });
            } else {
                return response.text().then(text => {
                    try {
                        // Try to parse as JSON even if content-type isn't set correctly
                        const data = JSON.parse(text);
                        return { data: data, text: JSON.stringify(data, null, 2), type: 'json' };
                    } catch (e) {
                        // If not valid JSON, check if it looks like HTML
                        if (text.trim().startsWith('<') && text.includes('</html>')) {
                            return { data: null, text: text, type: 'html' };
                        }
                        // Otherwise, return as text
                        return { data: null, text: text, type: 'text' };
                    }
                });
            }
        })
        .then(result => {
            if (result.type === 'json' && result.data) {
                // Handle special case for our structured report data
                if (result.data.name && result.data.stats && result.data.sections) {
                    displayReport(result.data);
                } else {
                    // Display regular JSON data
                    displayJsonReport(result.text, reportId);
                }
            } else if (result.type === 'html') {
                displayHtmlReport(result.text, reportId);
            } else {
                // For plain text or unknown format
                displayTextReport(result.text, reportId);
            }
        })
        .catch(error => {
            console.error("Error loading report:", error);
            showError('Report not found or could not be loaded: ' + error.message);
        });
}

/**
 * Display report in the UI
 */
function displayReport(reportData) {
    // Update report title and timestamp
    document.getElementById('reportName').textContent = reportData.name;
    document.getElementById('reportTimestamp').textContent = 'Generated on: ' + formatDate(reportData.generatedAt);
    
    // Get report content container
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = ''; // Clear loading spinner
    
    // Check if we're in dark mode
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColorClass = isDarkMode ? 'text-white' : '';
    
    // Create summary section
    const summarySection = document.createElement('div');
    summarySection.className = `report-summary-section ${textColorClass}`;
    summarySection.innerHTML = `
        <h4>Summary</h4>
        <p>${reportData.summary}</p>
        <div class="summary-stats">
            ${reportData.stats.map(stat => `
                <div class="summary-stat-card">
                    <div class="stat-number">${stat.value}</div>
                    <div class="stat-label">${stat.label}</div>
                </div>
            `).join('')}
        </div>
    `;
    reportContent.appendChild(summarySection);
    
    // Create details sections
    reportData.sections.forEach(section => {
        const sectionElem = document.createElement('div');
        sectionElem.className = `report-threats-section mb-4 ${textColorClass}`;
        
        // Add table-specific class for dark mode if needed
        const tableClass = isDarkMode ? 'table table-dark' : 'table';
        
        // Replace any standard table classes with dark mode aware ones
        let sectionContent = section.content;
        if (isDarkMode && sectionContent.includes('class="table"')) {
            sectionContent = sectionContent.replace('class="table"', `class="${tableClass}"`);
        }
        
        sectionElem.innerHTML = `
            <h4>${section.title}</h4>
            <div>${sectionContent}</div>
        `;
        reportContent.appendChild(sectionElem);
        
        // If section has a chart, create and render it
        if (section.chart) {
            const chartContainer = document.createElement('div');
            chartContainer.className = 'chart-body';
            sectionElem.appendChild(chartContainer);
            
            const canvas = document.createElement('canvas');
            chartContainer.appendChild(canvas);
            
            new Chart(canvas, section.chart);
        }
    });
}

/**
 * Display text or HTML report in the UI
 */
function displayTextReport(content, reportId) {
    // Update report title and timestamp
    document.getElementById('reportName').textContent = reportId;
    document.getElementById('reportTimestamp').textContent = 'Generated on: ' + new Date().toLocaleString();
    
    // Get report content container
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = ''; // Clear loading spinner
    
    // It's plain text, show in pre tag with proper word-wrap
    const pre = document.createElement('pre');
    pre.className = 'report-text';
    pre.style.whiteSpace = 'pre-wrap';       /* CSS3 */
    pre.style.wordWrap = 'break-word';       /* IE */
    pre.style.overflowWrap = 'break-word';   /* Modern browsers */
    pre.style.maxWidth = '100%';
    pre.style.overflow = 'auto';
    pre.textContent = content;
    reportContent.appendChild(pre);
}

/**
 * Display JSON report in the UI
 */
function displayJsonReport(jsonText, reportId) {
    // Update report title and timestamp
    document.getElementById('reportName').textContent = reportId;
    document.getElementById('reportTimestamp').textContent = 'Generated on: ' + new Date().toLocaleString();
    
    // Get report content container
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = ''; // Clear loading spinner
    
    // Create a properly styled code container for the JSON
    const preElement = document.createElement('pre');
    preElement.className = 'json-content';
    preElement.style.whiteSpace = 'pre-wrap';
    preElement.style.wordWrap = 'break-word';
    preElement.style.maxWidth = '100%';
    preElement.style.backgroundColor = 'rgba(0,0,0,0.05)';
    preElement.style.padding = '15px';
    preElement.style.borderRadius = '5px';
    preElement.style.overflow = 'auto';
    
    const codeElement = document.createElement('code');
    codeElement.textContent = jsonText;
    
    preElement.appendChild(codeElement);
    reportContent.appendChild(preElement);
    
    // Check if Prism syntax highlighter is available and use it
    if (typeof Prism !== 'undefined') {
        try {
            Prism.highlightElement(codeElement);
        } catch (e) {
            console.error("Error applying syntax highlighting:", e);
        }
    }
}

/**
 * Display HTML report in the UI
 */
function displayHtmlReport(htmlContent, reportId) {
    // Update report title and timestamp
    document.getElementById('reportName').textContent = reportId;
    document.getElementById('reportTimestamp').textContent = 'Generated on: ' + new Date().toLocaleString();
    
    // Get report content container
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = ''; // Clear loading spinner
    
    // Check if we're in dark mode - log this for debugging
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    console.log("Dark mode detected:", isDarkMode);
    
    // Create a plain wrapper div first - no iframe initially
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'html-content-wrapper';
    contentWrapper.style.width = '100%';
    contentWrapper.style.padding = '20px';
    contentWrapper.style.overflow = 'auto';
    contentWrapper.style.maxWidth = '100%';
    contentWrapper.style.minHeight = '800px';
    contentWrapper.style.backgroundColor = isDarkMode ? '#1e1e1e' : '#ffffff';
    contentWrapper.style.color = isDarkMode ? '#ffffff' : '#212529';
    contentWrapper.style.borderRadius = '5px';
    
    // Apply the dark theme directly to the HTML content
    if (isDarkMode) {
        // Replace any potential style tags that might interfere
        htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // Extract the body content only if possible
        let bodyContent = htmlContent;
        const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(htmlContent);
        if (bodyMatch && bodyMatch[1]) {
            bodyContent = bodyMatch[1];
        }
        
        // Create the content with dark mode styles
        contentWrapper.innerHTML = `
            <style>
                /* Base styles with !important to override everything */
                * {
                    color: #ffffff !important;
                    background-color: transparent !important;
                    border-color: #444 !important;
                }
                
                body, div, p, span, pre, code, h1, h2, h3, h4, h5, h6 {
                    color: #ffffff !important;
                }
                
                /* Style links */
                a, a:link, a:visited {
                    color: #61dafb !important;
                }
                
                /* Style tables */
                table, tr, td, th {
                    border: 1px solid #555 !important;
                }
                
                th {
                    background-color: #333 !important;
                    font-weight: bold !important;
                }
                
                /* Make tr alternating colors */
                tr:nth-child(even) {
                    background-color: #2c2c2c !important;
                }
                
                tr:nth-child(odd) {
                    background-color: #212529 !important;
                }
                
                /* Special case for pre/code */
                pre, code {
                    background-color: #2d2d2d !important;
                    color: #e9ecef !important;
                    padding: 8px !important;
                    border-radius: 4px !important;
                }
                
                /* Style headings distinctly */
                h1, h2, h3, h4, h5, h6 {
                    color: #ffffff !important;
                    border-bottom: 1px solid #444 !important;
                    padding-bottom: 0.3em !important;
                    margin-top: 1em !important;
                    margin-bottom: 0.5em !important;
                }
            </style>
            <div class="report-dark-mode-content">${bodyContent}</div>
        `;
    } else {
        // Light mode - just use the content directly
        contentWrapper.innerHTML = htmlContent;
    }
    
    reportContent.appendChild(contentWrapper);
    
    // Add script to process dark mode after the content is rendered
    if (isDarkMode) {
        setTimeout(() => {
            // Force styles on all elements after render
            const allElements = document.querySelectorAll('.html-content-wrapper *');
            allElements.forEach(el => {
                // Text elements should be white
                if (['DIV', 'P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH'].includes(el.tagName)) {
                    el.style.color = '#ffffff';
                }
                
                // Tables should have visible borders
                if (el.tagName === 'TABLE') {
                    el.style.borderCollapse = 'collapse';
                    el.style.width = '100%';
                    el.style.border = '1px solid #444';
                }
                
                if (el.tagName === 'TH' || el.tagName === 'TD') {
                    el.style.border = '1px solid #444';
                    el.style.padding = '8px';
                }
                
                if (el.tagName === 'TH') {
                    el.style.backgroundColor = '#333';
                }
            });
        }, 100);
    }
}

/**
 * Download report as PDF
 */
function downloadReport(reportId) {
    try {
        // In a real application, this would trigger a download from your backend
        // For demo purposes, show a notification
        if (typeof notifications !== 'undefined') {
            notifications.info(`Download initiated for report ${reportId}`);
        }
        
        // Simulate download preparation
        setTimeout(() => {
            const link = document.createElement('a');
            link.href = `/reports/${encodeURIComponent(reportId)}`;
            link.download = `report-${reportId}`;
            link.click();
        }, 500);
    } catch (e) {
        console.error("Error during report download:", e);
        alert(`Error downloading report: ${e.message}`);
    }
}

/**
 * Show error message
 */
function showError(message) {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = `
        <div class="alert alert-danger m-4" role="alert">
            <i class="fas fa-exclamation-circle me-2"></i>
            ${message}
        </div>
    `;
    
    document.getElementById('reportName').textContent = 'Error Loading Report';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleString();
    } catch (e) {
        console.error("Error formatting date:", e);
        return dateString || 'Unknown date';
    }
}

/**
 * Get simulated report data (would be replaced with actual API call)
 */
function getReportData(reportId) {
    // This is mock data - in a real app this would come from your API
    return {
        id: reportId,
        name: `Security Analysis Report #${reportId}`,
        generatedAt: new Date().toISOString(),
        summary: 'This report summarizes the security analysis results from the selected log files. Several potential security issues were identified that may require attention.',
        stats: [
            { label: 'Events Analyzed', value: '24,581' },
            { label: 'Issues Found', value: '17' },
            { label: 'Critical Alerts', value: '3' },
            { label: 'Performance Score', value: '86%' }
        ],
        sections: [
            {
                title: 'Top Threats',
                content: `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Threat Type</th>
                                <th>Severity</th>
                                <th>Count</th>
                                <th>Last Detected</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Brute Force Attempt</td>
                                <td><span class="badge bg-danger">Critical</span></td>
                                <td>128</td>
                                <td>Today, 14:25</td>
                            </tr>
                            <tr>
                                <td>Suspicious URL Access</td>
                                <td><span class="badge bg-warning text-dark">Medium</span></td>
                                <td>57</td>
                                <td>Today, 12:11</td>
                            </tr>
                            <tr>
                                <td>Privilege Escalation</td>
                                <td><span class="badge bg-danger">Critical</span></td>
                                <td>14</td>
                                <td>Yesterday, 23:04</td>
                            </tr>
                        </tbody>
                    </table>
                `,
                chart: {
                    type: 'bar',
                    data: {
                        labels: ['Brute Force', 'Suspicious URL', 'Privilege Escalation', 'Data Leakage', 'Malware'],
                        datasets: [{
                            label: 'Incidents',
                            data: [128, 57, 14, 8, 3],
                            backgroundColor: 'rgba(54, 162, 235, 0.5)',
                            borderColor: 'rgb(54, 162, 235)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                }
            },
            {
                title: 'Geographical Distribution',
                content: 'The following chart shows the geographical distribution of suspicious activities:',
                chart: {
                    type: 'pie',
                    data: {
                        labels: ['North America', 'Asia', 'Europe', 'South America', 'Unknown'],
                        datasets: [{
                            data: [45, 25, 20, 5, 5],
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.5)',
                                'rgba(54, 162, 235, 0.5)',
                                'rgba(255, 206, 86, 0.5)',
                                'rgba(75, 192, 192, 0.5)',
                                'rgba(153, 102, 255, 0.5)'
                            ],
                            borderColor: [
                                'rgba(255, 99, 132, 1)',
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 206, 86, 1)',
                                'rgba(75, 192, 192, 1)',
                                'rgba(153, 102, 255, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                }
            }
        ]
    };
}
