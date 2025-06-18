import json
from datetime import datetime
import hashlib
import os

def generate_report(threats, output_file, format_type):
    """Generate a report of identified threats."""
    # Enrich threats with additional information
    enriched_threats = _enrich_threats(threats)
    
    if format_type == 'txt':
        _generate_txt_report(enriched_threats, output_file)
    elif format_type == 'json':
        _generate_json_report(enriched_threats, output_file)
    elif format_type == 'html':
        _generate_html_report(enriched_threats, output_file)
    else:
        print(f"Unsupported report format: {format_type}")

def _enrich_threats(threats):
    """Add additional information to threats before reporting."""
    enriched = []
    for threat in threats:
        # Create a copy to avoid modifying the original
        t = threat.copy()
        
        # Add file hash if file exists
        if os.path.exists(t.get('file', '')):
            try:
                with open(t['file'], 'rb') as f:
                    content = f.read()
                    t['file_hash'] = {
                        'md5': hashlib.md5(content).hexdigest(),
                        'sha256': hashlib.sha256(content).hexdigest()
                    }
            except:
                pass
        
        # Add context lines if not already present
        if 'context_before' not in t and 'context_after' not in t and os.path.exists(t.get('file', '')):
            try:
                with open(t['file'], 'r') as f:
                    lines = f.readlines()
                    line_num = t.get('line_num', 0)
                    context_before = max(0, line_num - 3)
                    context_after = min(len(lines), line_num + 2)
                    t['context_before'] = [lines[i].rstrip() for i in range(context_before, line_num - 1)]
                    t['context_after'] = [lines[i].rstrip() for i in range(line_num, context_after)]
            except:
                pass
        
        # Add risk score if not present
        if 'risk_score' not in t:
            severity_scores = {'critical': 9, 'high': 7, 'medium': 5, 'low': 3, 'info': 1}
            t['risk_score'] = severity_scores.get(t.get('severity', 'low'), 0)
        
        # Add detection timestamp if not present
        if 'detection_time' not in t:
            t['detection_time'] = datetime.now().isoformat()
            
        enriched.append(t)
    return enriched

def _generate_txt_report(threats, output_file):
    """Generate a text report."""
    with open(output_file, 'w') as f:
        f.write("THREAT ANALYSIS REPORT\n")
        f.write("===========================\n\n")
        f.write(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total threats found: {len(threats)}\n\n")
        
        # Add executive summary
        severity_count = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for threat in threats:
            severity = threat.get('severity', 'low')
            severity_count[severity] = severity_count.get(severity, 0) + 1
        
        f.write("EXECUTIVE SUMMARY\n")
        f.write("-----------------\n")
        for severity, count in severity_count.items():
            if count > 0:
                f.write(f"{severity.upper()} severity threats: {count}\n")
        f.write("\n")
        
        # Group threats by severity
        severity_groups = {}
        for threat in threats:
            severity = threat.get('severity', 'low')
            if severity not in severity_groups:
                severity_groups[severity] = []
            severity_groups[severity].append(threat)
        
        # Print threats by severity (high to low)
        for severity in ['critical', 'high', 'medium', 'low', 'info']:
            if severity in severity_groups:
                f.write(f"\n{severity.upper()} SEVERITY THREATS ({len(severity_groups[severity])})\n")
                f.write("-" * (len(severity.upper() + " SEVERITY THREATS") + 4) + "\n\n")
                
                for i, threat in enumerate(severity_groups[severity], 1):
                    f.write(f"Threat #{i} - {threat['rule_name']}\n")
                    f.write(f"File: {threat['file']} (line {threat['line_num']})\n")
                    if 'file_hash' in threat:
                        f.write(f"File MD5: {threat['file_hash']['md5']}\n")
                        f.write(f"File SHA256: {threat['file_hash']['sha256']}\n")
                    f.write(f"Detection time: {threat.get('detection_time', 'N/A')}\n")
                    f.write(f"Severity: {severity.upper()} (Risk Score: {threat.get('risk_score', 'N/A')})\n")
                    f.write(f"Matched: {threat['matched']}\n")
                    
                    # Print category if available
                    if 'category' in threat:
                        f.write(f"Category: {threat['category']}\n")
                    
                    # Print all matched strings if available
                    if 'matched_strings' in threat and threat['matched_strings']:
                        f.write("Matched strings:\n")
                        for string_id, offset, string_data in threat['matched_strings']:
                            f.write(f"  - {string_id} at offset {offset}: {string_data}\n")
                    
                    if threat.get('description'):
                        f.write(f"Description: {threat['description']}\n")
                    if threat.get('remediation'):
                        f.write(f"Remediation: {threat['remediation']}\n")
                    
                    # Print code context
                    f.write(f"Code context:\n")
                    if 'context_before' in threat and threat['context_before']:
                        for line in threat['context_before']:
                            f.write(f"    {line}\n")
                    f.write(f">>> {threat['line']}\n")
                    if 'context_after' in threat and threat['context_after']:
                        for line in threat['context_after']:
                            f.write(f"    {line}\n")
                    
                    # Print references if available
                    if 'references' in threat:
                        f.write("References:\n")
                        for ref in threat['references']:
                            f.write(f"  - {ref}\n")
                    
                    # Print CVE IDs if available
                    if 'cve_ids' in threat:
                        f.write("CVE IDs:\n")
                        for cve in threat['cve_ids']:
                            f.write(f"  - {cve}\n")
                    
                    # Print false positive assessment if available
                    if 'false_positive_likelihood' in threat:
                        f.write(f"False positive likelihood: {threat['false_positive_likelihood']}\n")
                    
                    f.write("\n")

def _generate_json_report(threats, output_file):
    """Generate a JSON report."""
    # Calculate summary metrics
    severity_count = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for threat in threats:
        severity = threat.get('severity', 'low')
        severity_count[severity] = severity_count.get(severity, 0) + 1
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_threats': len(threats),
        'summary': {
            'by_severity': severity_count,
            'risk_score_avg': sum(threat.get('risk_score', 0) for threat in threats) / max(len(threats), 1)
        },
        'threats': threats
    }
    
    with open(output_file, 'w') as f:
        json.dump(report, f, indent=2)

def _generate_html_report(threats, output_file):
    """Generate an HTML report."""
    # Calculate summary metrics
    severity_count = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for threat in threats:
        severity = threat.get('severity', 'low')
        severity_count[severity] = severity_count.get(severity, 0) + 1
    
    # Group threats by severity
    severity_groups = {}
    for threat in threats:
        severity = threat.get('severity', 'low')
        if severity not in severity_groups:
            severity_groups[severity] = []
        severity_groups[severity].append(threat)
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Threat Analysis Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        h1 {{ color: #333; }}
        .summary {{ margin-bottom: 20px; padding: 15px; background-color: #f4f4f4; border-radius: 5px; }}
        .critical {{ background-color: #ffdddd; }}
        .high {{ background-color: #ffeecc; }}
        .medium {{ background-color: #ffffcc; }}
        .low {{ background-color: #e6ffe6; }}
        .info {{ background-color: #e6f2ff; }}
        .threat {{ margin-bottom: 20px; padding: 15px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }}
        .threat-header {{ font-weight: bold; font-size: 1.1em; margin-bottom: 10px; }}
        pre {{ background-color: #f8f8f8; padding: 10px; overflow-x: auto; border-radius: 3px; }}
        .matched-strings {{ margin-left: 20px; }}
        .code-context {{ border-left: 3px solid #ddd; padding-left: 10px; }}
        .code-highlight {{ background-color: #fff3cd; font-weight: bold; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 15px; }}
        th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #f2f2f2; }}
        .references {{ margin-top: 10px; }}
        .references a {{ color: #0066cc; }}
    </style>
</head>
<body>
    <h1>YARA Threat Analysis Report</h1>
    
    <div class="summary">
        <h2>Executive Summary</h2>
        <p><strong>Generated at:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p><strong>Total threats found:</strong> {len(threats)}</p>
        
        <table>
            <tr>
                <th>Severity</th>
                <th>Count</th>
            </tr>
    """
    
    for severity, count in severity_count.items():
        if count > 0:
            html += f"""
            <tr>
                <td>{severity.upper()}</td>
                <td>{count}</td>
            </tr>
            """
    
    html += """
        </table>
    </div>
    """
    
    # Add threats by severity
    for severity in ['critical', 'high', 'medium', 'low', 'info']:
        if severity in severity_groups:
            html += f"""
    <h2>{severity.upper()} SEVERITY THREATS ({len(severity_groups[severity])})</h2>
    """
            
            for i, threat in enumerate(severity_groups[severity], 1):
                html += f"""
    <div class="threat {severity}">
        <div class="threat-header">Threat #{i} - {threat['rule_name']}</div>
        <table>
            <tr>
                <td><strong>File:</strong></td>
                <td>{threat['file']} (line {threat['line_num']})</td>
            </tr>
    """
                if 'file_hash' in threat:
                    html += f"""
            <tr>
                <td><strong>File MD5:</strong></td>
                <td>{threat['file_hash']['md5']}</td>
            </tr>
            <tr>
                <td><strong>File SHA256:</strong></td>
                <td>{threat['file_hash']['sha256']}</td>
            </tr>
    """
                html += f"""
            <tr>
                <td><strong>Detection time:</strong></td>
                <td>{threat.get('detection_time', 'N/A')}</td>
            </tr>
            <tr>
                <td><strong>Severity:</strong></td>
                <td>{severity.upper()} (Risk Score: {threat.get('risk_score', 'N/A')})</td>
            </tr>
            <tr>
                <td><strong>Matched:</strong></td>
                <td>{threat['matched']}</td>
            </tr>
    """
                if 'category' in threat:
                    html += f"""
            <tr>
                <td><strong>Category:</strong></td>
                <td>{threat['category']}</td>
            </tr>
    """
                html += """
        </table>
    """
                
                # Add matched strings if available
                if 'matched_strings' in threat and threat['matched_strings']:
                    html += "<p><strong>Matched strings:</strong></p><ul class='matched-strings'>"
                    for string_id, offset, string_data in threat['matched_strings']:
                        html += f"<li>{string_id} at offset {offset}: {string_data}</li>"
                    html += "</ul>"
                
                if threat.get('description'):
                    html += f"<p><strong>Description:</strong> {threat['description']}</p>"
                if threat.get('remediation'):
                    html += f"<p><strong>Remediation:</strong> {threat['remediation']}</p>"
                
                # Add code context
                html += f"""
        <p><strong>Code context:</strong></p>
        <pre class="code-context">
"""
                if 'context_before' in threat and threat['context_before']:
                    for line in threat['context_before']:
                        html += f"{line}\n"
                html += f'<span class="code-highlight">{threat["line"]}</span>\n'
                if 'context_after' in threat and threat['context_after']:
                    for line in threat['context_after']:
                        html += f"{line}\n"
                html += """</pre>
    """
                
                # Add references if available
                if 'references' in threat:
                    html += '<div class="references"><p><strong>References:</strong></p><ul>'
                    for ref in threat['references']:
                        html += f'<li><a href="{ref}" target="_blank">{ref}</a></li>'
                    html += '</ul></div>'
                
                # Add CVE IDs if available
                if 'cve_ids' in threat:
                    html += '<div class="references"><p><strong>CVE IDs:</strong></p><ul>'
                    for cve in threat['cve_ids']:
                        cve_url = f"https://cve.mitre.org/cgi-bin/cvename.cgi?name={cve}"
                        html += f'<li><a href="{cve_url}" target="_blank">{cve}</a></li>'
                    html += '</ul></div>'
                
                # Add false positive likelihood if available
                if 'false_positive_likelihood' in threat:
                    html += f"<p><strong>False positive likelihood:</strong> {threat['false_positive_likelihood']}</p>"
                
                html += """
    </div>
    """
    
    html += """
</body>
</html>
    """
    
    with open(output_file, 'w') as f:
        f.write(html)
