#!/usr/bin/env python3
import argparse
import os
from dotenv import load_dotenv
from analyzer import LogAnalyzer
from report_generator import generate_report

def parse_arguments():
    parser = argparse.ArgumentParser(description='Analyze log files for security threats using AI')
    parser.add_argument('log_files', nargs='+', help='Path to log files to analyze')
    parser.add_argument('--output', default='threat_report.txt', help='Output file for the report')
    parser.add_argument('--format', choices=['txt', 'json', 'html'], default='txt', help='Output format')
    parser.add_argument('--api-key', help='HuggingFace API key (overrides environment variable)')
    return parser.parse_args()

def main():
    # Load environment variables
    load_dotenv()
    
    args = parse_arguments()
    
    # Use API key from args or environment
    api_key = args.api_key or os.environ.get("API_KEY", "")
    
    if not api_key:
        print("Error: HuggingFace API key is required. Set it with --api-key or in the .env file.")
        return
    
    try:
        # Initialize analyzer with API key
        analyzer = LogAnalyzer(api_key)
        
        # Process each log file
        results = []
        for log_file in args.log_files:
            if not os.path.exists(log_file):
                print(f"Warning: Log file '{log_file}' does not exist.")
                continue
            
            print(f"Analyzing {log_file}...")
            file_results = analyzer.analyze_file(log_file)
            results.extend(file_results)
        
        # Generate report
        generate_report(results, args.output, args.format)
        print(f"\nAnalysis complete. Found {len(results)} potential threats.")
        print(f"Report saved to {args.output}")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()
