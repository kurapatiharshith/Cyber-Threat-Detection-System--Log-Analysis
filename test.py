import os
import glob
from typing import Dict, Any, List, Optional
from huggingface_hub import InferenceClient

class LogAnalyzer:
    def __init__(self, api_key: str):
        """Initialize with HuggingFace API key."""
        self.client = InferenceClient(provider="nebius", api_key=api_key)
        self.model = "deepseek-ai/DeepSeek-R1"
        self.max_tokens = 500

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
        log_files = {}
        for file_path in glob.glob(os.path.join(directory, pattern)):
            file_name = os.path.basename(file_path)
            log_content = self.read_log_file(file_path)
            log_files[file_name] = log_content
        return log_files

    def ask_question(self, log_content: str, question: str) -> Dict[str, Any]:
        """Ask a question about the log content using the model."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": "You are a log analysis assistant. Answer questions about the log content provided, extracting specific information when asked."
                },
                {
                    "role": "user",
                    "content": f"Log content: {log_content[:8000]}\n\nQuestion: {question}"
                }
            ]
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
            )
            
            answer = completion.choices[0].message.content
            return {"answer": answer, "score": 1.0}  # Score not applicable with this API
        except Exception as e:
            return {"error": str(e), "answer": "Failed to process question", "score": 0}

    def summarize_log(self, log_content: str, max_length: int = 150) -> str:
        """Generate a summary of the log file."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": f"You are a log summarization assistant. Provide a concise summary of the log content in about {max_length} words."
                },
                {
                    "role": "user",
                    "content": f"Log content: {log_content[:5000]}"
                }
            ]
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
            )
            
            return completion.choices[0].message.content
        except Exception as e:
            return f"Could not generate summary: {str(e)}"
    
    def analyze_sentiment(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment of log entries to detect issues."""
        try:
            messages = [
                {
                    "role": "system",
                    "content": "You are a log analysis assistant that detects issues and sentiment in log files. Classify the log content as POSITIVE if it shows normal operation or NEGATIVE if it contains errors, warnings or issues."
                },
                {
                    "role": "user",
                    "content": f"Log content: {text[:5000]}"
                }
            ]
            
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
            )
            
            response = completion.choices[0].message.content
            
            # Simple parsing logic - can be improved
            if "NEGATIVE" in response.upper():
                return {"label": "NEGATIVE", "score": 0.9}
            else:
                return {"label": "POSITIVE", "score": 0.9}
        except Exception as e:
            return {"error": str(e), "label": "UNKNOWN", "score": 0}

def interactive_log_analysis(log_path: Optional[str] = None):
    """Run interactive log analysis session."""
    # Get API key from environment or input
    api_key = os.environ.get("API_KEY", "")
    if not api_key:
        api_key = input("Enter your HuggingFace API key: ")
    
    analyzer = LogAnalyzer(api_key)
    
    # Get log file path if not provided
    if not log_path:
        log_path = input("Enter path to log file or directory: ")
    
    # Process single file or directory
    if os.path.isdir(log_path):
        log_files = analyzer.read_log_directory(log_path)
        print(f"Found {len(log_files)} log files")
        
        # Ask if user wants to analyze files individually or combine them
        choice = input("Analyze logs individually (i) or combined (c)? ").lower()
        
        if choice == 'c':
            # Combine all logs
            combined_content = "\n".join(log_files.values())
            log_contents = {"Combined Logs": combined_content}
        else:
            log_contents = log_files
    else:
        # Single file
        content = analyzer.read_log_file(log_path)
        log_contents = {os.path.basename(log_path): content}
    
    # Process each log
    for name, content in log_contents.items():
        if not content:
            print(f"No content in {name}, skipping.")
            continue
            
        print(f"\n===== Analyzing: {name} =====")
        
        # Generate summary
        print("\nSummary:")
        summary = analyzer.summarize_log(content)
        print(summary)
        
        # Interactive Q&A
        print("\nYou can now ask questions about this log (type 'exit' to finish)")
        while True:
            question = input("\nQuestion: ")
            if question.lower() in ['exit', 'quit', 'q']:
                break
                
            result = analyzer.ask_question(content, question)
            if "error" in result:
                print(f"Error: {result['error']}")
            else:
                print(f"Answer: {result['answer']}")
                # No confidence score available with this API
                if "score" in result and result["score"] > 0:
                    print(f"Confidence: {result['score']:.2%}")

if __name__ == "__main__":
    interactive_log_analysis()