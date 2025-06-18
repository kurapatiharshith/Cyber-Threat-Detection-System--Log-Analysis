import os
import ipaddress
from datetime import datetime
from typing import Dict, Any, List
from huggingface_hub import InferenceClient

class LogAnalyzer:
    def __init__(self, api_key=None):
        """Initialize with HuggingFace API credentials"""
        if api_key is None:
            api_key = os.environ.get("API_KEY", "")
        
        self.client = InferenceClient(provider="nebius", api_key=api_key)
        self.model = "deepseek-ai/DeepSeek-R1"
        self.max_tokens = 500
    
    def analyze_file(self, log_file):
        """Analyze a log file for potential threats using the AI model."""
        detected_threats = []
        
        # Read file content
        try:
            with open(log_file, 'r', errors='replace') as f:
                content = f.read()
                
            if not content.strip():
                return detected_threats
                
            # Use AI to analyze the content for security threats
            threats = self._analyze_with_ai(content, log_file)
            detected_threats.extend(threats)
                
        except Exception as e:
            print(f"Error analyzing file {log_file}: {str(e)}")
        
        return detected_threats
    
    def _analyze_with_ai(self, content, log_file):
        """Use the AI model to analyze the content for security threats"""
        threats = []
        
        try:
            # Prepare the prompt for security analysis
            messages = [
                {
                    "role": "system",
                    "content": """You are a cybersecurity log analysis expert. Analyze the provided log content for security threats like:
                    - Failed login attempts
                    - SQL injection attempts
                    - XSS attacks
                    - Access to sensitive files
                    - Command injection attempts
                    - Port scanning
                    - DoS/DDoS attacks
                    - Unauthorized admin access
                    
                    For each threat found, provide:
                    1. Threat ID (like AUTH-001 for authentication issues)
                    2. Threat name
                    3. Severity (critical, high, medium, low)
                    4. Affected line
                    5. Description
                    6. Remediation advice
                    
                    Format your response as JSON with an array of threat objects."""
                },
                {
                    "role": "user",
                    "content": f"Log content to analyze for security threats:\n\n{content[:10000]}"
                }
            ]
            
            # Call the model
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
            )
            
            response = completion.choices[0].message.content
            
            # Process the AI response to extract threats
            # This is a simplified approach - in production, you'd want to parse the JSON properly
            import json
            import re
            
            # Try to extract JSON from the response
            json_match = re.search(r'```json\s*([\s\S]*?)\s*```', response)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_str = response
            
            try:
                # Try to parse the output as JSON
                threat_data = json.loads(json_str)
                
                # Process each detected threat
                if isinstance(threat_data, dict) and "threats" in threat_data:
                    detected_threats = threat_data["threats"]
                elif isinstance(threat_data, list):
                    detected_threats = threat_data
                else:
                    detected_threats = [threat_data]
                
                # Create standardized threat objects
                for i, threat_info in enumerate(detected_threats, 1):
                    # Extract information with fallbacks
                    threat_id = threat_info.get("id", f"AI-{i:03d}")
                    name = threat_info.get("name", f"AI Detected Threat {i}")
                    severity = threat_info.get("severity", "medium").lower()
                    description = threat_info.get("description", "Potential security threat detected by AI")
                    remediation = threat_info.get("remediation", "Review the log entry and take appropriate action")
                    line_text = threat_info.get("line", "Unknown")
                    line_num = threat_info.get("line_num", 0)
                    
                    threats.append({
                        'rule_id': threat_id,
                        'rule_name': name,
                        'severity': severity,
                        'line': line_text,
                        'line_num': line_num,
                        'file': log_file,
                        'matched': line_text,
                        'timestamp': datetime.now().isoformat(),
                        'description': description,
                        'remediation': remediation,
                    })
            except json.JSONDecodeError:
                # If JSON parsing fails, create a single general threat with COMPLETE analysis
                # Format the response for better readability - remove think tags and newlines
                formatted_response = response.replace('<think>', '').replace('</think>', '')
                # Replace newlines with spaces for a single paragraph
                formatted_response = ' '.join(formatted_response.splitlines())
                
                # Create a complete description with the full AI analysis as a single paragraph
                full_description = 'The AI analyzed the log and found potential issues. Complete analysis: ' + formatted_response
                
                threats.append({
                    'rule_id': 'AI-GEN',
                    'rule_name': 'AI Generated Security Analysis',
                    'severity': 'medium',
                    'line': content[:100] + '...',
                    'line_num': 1,
                    'file': log_file,
                    'matched': 'AI analysis',
                    'timestamp': datetime.now().isoformat(),
                    'description': full_description,
                    'remediation': 'Review the AI findings manually',
                })
                
        except Exception as e:
            threats.append({
                'rule_id': 'ERROR',
                'rule_name': 'AI Analysis Error',
                'severity': 'low',
                'line': '',
                'line_num': 0,
                'file': log_file,
                'matched': str(e),
                'timestamp': datetime.now().isoformat(),
                'description': f'Error during AI analysis: {str(e)}',
                'remediation': 'Check API connection and try again',
            })
        
        return threats
    
    def read_log_file(self, file_path: str) -> str:
        """Read a log file and return its contents as a string."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as file:
                return file.read()
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            return ""
            
    def read_log_directory(self, directory: str, pattern: str = "*.log") -> Dict[str, str]:
        """Read multiple log files matching a pattern in a directory."""
        import glob
        
        log_files = {}
        for file_path in glob.glob(os.path.join(directory, pattern)):
            file_name = os.path.basename(file_path)
            log_content = self.read_log_file(file_path)
            log_files[file_name] = log_content
        return log_files
