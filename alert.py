import json
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional


class DiscordAlert:
    def __init__(self, webhook_url: str):
        """Initialize Discord alert with webhook URL.
        
        Args:
            webhook_url: Discord webhook URL
        """
        self.webhook_url = webhook_url
        
    def send_scan_complete_notification(
        self, 
        scan_results: Dict[str, Any], 
        report_url: str,
        dashboard_url: Optional[str] = None
    ) -> bool:
        """Send a Discord notification when scan is complete.
        
        Args:
            scan_results: Dictionary with scan results including threat counts
            report_url: URL to the full report
            dashboard_url: Optional URL to the dashboard
            
        Returns:
            bool: True if notification was sent successfully
        """
        try:
            # Get basic stats
            total_threats = scan_results.get("total_threats", 0)
            severity_counts = scan_results.get("severity_count", {})
            
            # Create embed for Discord message
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Format threat counts by severity for the description
            severity_text = "\n".join([
                f"• **{severity.upper()}**: {count}" 
                for severity, count in severity_counts.items() 
                if count > 0
            ])
            
            if not severity_text:
                severity_text = "• No threats found"
            
            # Create the main message content
            content = "## 🔍 Log Analysis Complete!"
            
            # Create the webhook payload with embed
            payload = {
                "content": content,
                "embeds": [
                    {
                        "title": f"Found {total_threats} potential threats",
                        "description": f"### Threats by Severity\n{severity_text}",
                        "color": self._get_color_for_severity(severity_counts),
                        "footer": {"text": f"Scan completed at {current_time}"},
                        "url": report_url
                    }
                ],
                "components": [
                    {
                        "type": 1,  # Action Row
                        "components": [
                            {
                                "type": 2,  # Button
                                "label": "View Report",
                                "style": 5,  # Link button
                                "url": report_url
                            }
                        ]
                    }
                ]
            }
            
            # Add dashboard button if provided
            if dashboard_url:
                payload["components"][0]["components"].append({
                    "type": 2,  # Button
                    "label": "View in Dashboard",
                    "style": 5,  # Link button
                    "url": dashboard_url
                })
            
            # Send the webhook request
            response = requests.post(
                self.webhook_url,
                json=payload
            )
            
            # Check if the request was successful (status code 204)
            if response.status_code == 204:
                return True
            else:
                print(f"Failed to send Discord notification: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            print(f"Error sending Discord notification: {str(e)}")
            return False
    
    def send_threat_details(self, threats: List[Dict[str, Any]]) -> bool:
        """Send detailed information about specific threats to Discord.
        
        Args:
            threats: List of threat dictionaries
            
        Returns:
            bool: True if notification was sent successfully
        """
        try:
            if not threats:
                return False
                
            # We can only send up to 10 embeds in one message
            threats_to_send = threats[:10]
            
            embeds = []
            for threat in threats_to_send:
                severity = threat.get("severity", "low")
                embeds.append({
                    "title": threat.get("rule_name", "Unknown Threat"),
                    "description": self._format_threat_description(threat),
                    "color": self._severity_to_color(severity),
                    "fields": [
                        {
                            "name": "Severity",
                            "value": severity.upper(),
                            "inline": True
                        },
                        {
                            "name": "File",
                            "value": threat.get("file", "Unknown").split("\\")[-1],
                            "inline": True
                        },
                        {
                            "name": "Line",
                            "value": str(threat.get("line_num", "N/A")),
                            "inline": True
                        }
                    ]
                })
            
            payload = {
                "content": f"## Detailed Threat Information ({len(threats_to_send)} of {len(threats)})",
                "embeds": embeds
            }
            
            # Send the webhook request
            response = requests.post(
                self.webhook_url,
                json=payload
            )
            
            # Check if the request was successful (status code 204)
            if response.status_code == 204:
                return True
            else:
                print(f"Failed to send Discord threat details: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            print(f"Error sending Discord threat details: {str(e)}")
            return False
    
    def _format_threat_description(self, threat: Dict[str, Any]) -> str:
        """Format a threat description for Discord display.
        
        Args:
            threat: Threat dictionary
            
        Returns:
            str: Formatted description
        """
        description = threat.get("description", "No description available")
        # Truncate if too long for Discord
        if len(description) > 300:
            description = description[:297] + "..."
            
        # Add remediation if available
        remediation = threat.get("remediation")
        if remediation:
            description += f"\n\n**Remediation**: {remediation}"
        
        return description
    
    def _severity_to_color(self, severity: str) -> int:
        """Convert severity to Discord color code.
        
        Args:
            severity: Threat severity
            
        Returns:
            int: Discord color code
        """
        severity_colors = {
            "critical": 0xFF0000,  # Red
            "high": 0xFF8000,      # Orange
            "medium": 0xFFFF00,    # Yellow
            "low": 0x00FF00,       # Green
            "info": 0x0080FF       # Blue
        }
        return severity_colors.get(severity.lower(), 0x808080)  # Default gray
    
    def _get_color_for_severity(self, severity_counts: Dict[str, int]) -> int:
        """Get the appropriate color based on the highest severity with count > 0.
        
        Args:
            severity_counts: Dictionary of severity counts
            
        Returns:
            int: Discord color code
        """
        for severity in ["critical", "high", "medium", "low", "info"]:
            if severity in severity_counts and severity_counts[severity] > 0:
                return self._severity_to_color(severity)
        return 0x00FF00  # Default green if no threats
        

def send_discord_notification(
    webhook_url: str, 
    scan_results: Dict[str, Any], 
    report_url: str,
    dashboard_url: Optional[str] = None
) -> bool:
    """Helper function to send scan results to Discord.
    
    Args:
        webhook_url: Discord webhook URL
        scan_results: Dictionary with scan results
        report_url: URL to the full report
        dashboard_url: Optional URL to the dashboard
        
    Returns:
        bool: True if notification was sent successfully
    """
    alert = DiscordAlert(webhook_url)
    return alert.send_scan_complete_notification(scan_results, report_url, dashboard_url)


def send_discord_threat_details(
    webhook_url: str, 
    threats: List[Dict[str, Any]]
) -> bool:
    """Helper function to send detailed threat information to Discord.
    
    Args:
        webhook_url: Discord webhook URL
        threats: List of threat dictionaries
        
    Returns:
        bool: True if notification was sent successfully
    """
    alert = DiscordAlert(webhook_url)
    return alert.send_threat_details(threats)
