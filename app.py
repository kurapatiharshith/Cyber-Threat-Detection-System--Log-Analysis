import datetime
from flask import Flask, request, render_template, jsonify, send_file, redirect, url_for, session, flash
import os
import glob
import json
import uuid
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from analyzer import LogAnalyzer
from report_generator import generate_report
from dotenv import load_dotenv
from alert import send_discord_notification

# Make sure the template folder is correctly set
app = Flask(__name__, 
            template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates'),
            static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'))
app.secret_key = os.environ.get("SECRET_KEY", "dev_key_replace_in_production")
# Set maximum upload file size to 16 MB
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Debug information to help troubleshoot
print(f"Template folder: {app.template_folder}")
print(f"Templates exist: {os.path.exists(app.template_folder)}")
print(f"Login template exists: {os.path.exists(os.path.join(app.template_folder, 'login.html'))}")
print(f"Layout template exists: {os.path.exists(os.path.join(app.template_folder, 'layout.html'))}")

# Setup Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Load environment variables
load_dotenv()

# Ensure the uploads directory exists
UPLOAD_FOLDER = 'uploads'
REPORTS_FOLDER = 'reports'
ACTIVITY_LOGS_FILE = 'activity_logs.json'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(REPORTS_FOLDER):
    os.makedirs(REPORTS_FOLDER)

# Simple user class for demonstration
class User(UserMixin):
    def __init__(self, id, username, email, password, is_admin=False):
        self.id = id
        self.username = username
        self.email = email
        self.password = password  # In production, store hashed passwords!
        self.is_admin = is_admin
        self.status = 'active'
        self.last_login = None
        self.created = datetime.datetime.now().isoformat()

# For demonstration, create an admin user
users = {
    '1': User('1', 'admin', 'admin@example.com', 'admin123', True)
}

@login_manager.user_loader
def load_user(user_id):
    return users.get(user_id)

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    # Return a simple message for troubleshooting
    print("Rendering login template from index route")
    return render_template('login.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = 'remember' in request.form
        
        # Find user by username
        user = next((u for u in users.values() if u.username == username), None)
        
        if user and user.password == password:  # In production, use password hashing!
            login_user(user, remember=remember)
            user.last_login = datetime.datetime.now().isoformat()
            
            # Log activity
            log_activity('login', {
                'username': username,
                'success': True
            })
            
            return redirect(url_for('dashboard'))
        
        flash('Invalid username or password', 'danger')
        
        # Log failed login attempt
        log_activity('login', {
            'username': username,
            'success': False
        })
    
    # Return a simple message for troubleshooting
    print("Rendering login template from login route")
    return render_template('login.html')

# Update logout route to redirect with cache-busting
@app.route('/logout')
@login_required
def logout():
    log_activity('logout', {
        'username': current_user.username
    })
    logout_user()
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    return redirect(url_for('login', _t=timestamp))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/logs')
@login_required
def logs():
    return render_template('logs.html')

@app.route('/reports')
@login_required
def reports():
    return render_template('reports.html')

@app.route('/settings')
@login_required
def settings():
    api_key = os.environ.get("API_KEY", "")
    discord_webhook = os.environ.get("DISCORD_WEBHOOK", "")
    return render_template('settings.html', api_key=api_key, discord_webhook=discord_webhook)

@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('dashboard'))
    return render_template('admin.html')

@app.route('/log_activity', methods=['POST'])
@login_required
def log_activity_endpoint():
    data = request.json
    if data:
        activity_type = data.get('activity_type')
        details = data.get('details', {})
        
        # Log the activity
        success = log_activity(activity_type, details)
        
        if success:
            return jsonify({"success": True})
    
    return jsonify({"success": False, "message": "Failed to log activity"}), 400

# Helper function to log activities
def log_activity(activity_type, details=None):
    try:
        logs = []
        if os.path.exists(ACTIVITY_LOGS_FILE):
            with open(ACTIVITY_LOGS_FILE, 'r') as f:
                logs = json.load(f)
        
        ip = request.remote_addr
        username = getattr(current_user, 'username', 'anonymous') if 'current_user' in globals() else 'anonymous'
        
        logs.append({
            'id': str(uuid.uuid4()),
            'timestamp': datetime.datetime.now().isoformat(),
            'username': username,
            'ip_address': ip,
            'activity_type': activity_type,
            'details': details or {}
        })
        
        with open(ACTIVITY_LOGS_FILE, 'w') as f:
            json.dump(logs, f, indent=2)
        
        return True
    except Exception as e:
        print(f"Error logging activity: {e}")
        return False

@app.route('/admin/users')
@login_required
def admin_users():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    users_list = []
    for user in users.values():
        users_list.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'status': user.status,
            'last_login': user.last_login,
            'created': user.created
        })
    
    return jsonify({"users": users_list})

@app.route('/admin/users/<user_id>')
@login_required
def get_user(user_id):
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    user = users.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    user_data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'is_admin': user.is_admin,
        'status': user.status
    }
    
    return jsonify({"user": user_data})

@app.route('/admin/users/add', methods=['POST'])
@login_required
def add_user():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    role = request.form.get('role')
    
    # Check if username already exists
    if any(u.username == username for u in users.values()):
        return jsonify({"success": False, "message": "Username already exists"}), 400
    
    # Generate new user ID
    user_id = str(len(users) + 1)
    
    # Create new user
    new_user = User(
        user_id,
        username,
        email,
        password,
        role == 'admin'
    )
    
    users[user_id] = new_user
    
    log_activity('user_management', {
        'action': 'add_user',
        'username': username,
        'is_admin': role == 'admin'
    })
    
    return jsonify({"success": True})

@app.route('/admin/activity_logs')
@login_required
def get_activity_logs():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 25))
    filter_type = request.args.get('filter', 'all')
    
    logs = []
    if os.path.exists(ACTIVITY_LOGS_FILE):
        with open(ACTIVITY_LOGS_FILE, 'r') as f:
            logs = json.load(f)
    
    # Apply filter
    if filter_type != 'all':
        logs = [log for log in logs if log.get('activity_type') == filter_type]
    
    # Sort logs by timestamp (newest first)
    logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
    
    # Calculate pagination
    total_logs = len(logs)
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    logs_page = logs[start_idx:end_idx]
    
    return jsonify({
        "logs": logs_page,
        "total_logs": total_logs
    })

@app.route('/settings/user', methods=['POST'])
@login_required
def update_user_settings():
    email = request.form.get('email')
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    
    # Update email
    if email:
        current_user.email = email
    
    # Update password if provided
    if current_password and new_password:
        if current_user.password == current_password:  # In production, use password hashing!
            current_user.password = new_password
        else:
            return jsonify({"success": False, "message": "Current password is incorrect"})
    
    log_activity('settings_change', {
        'type': 'user_profile',
        'email_updated': bool(email),
        'password_updated': bool(current_password and new_password)
    })
    
    return jsonify({"success": True})

@app.route('/settings/api', methods=['POST'])
@login_required
def update_api_settings():
    api_key = request.form.get('api_key')
    api_threshold = request.form.get('api_threshold')
    
    if api_key:
        os.environ["API_KEY"] = api_key
    
    log_activity('settings_change', {
        'type': 'api_settings',
        'api_key_updated': bool(api_key),
        'threshold_updated': bool(api_threshold)
    })
    
    return jsonify({"success": True})

@app.route('/settings/notifications', methods=['POST'])
@login_required
def update_notification_settings():
    discord_webhook = request.form.get('discord_webhook')
    notify_on_upload = request.form.get('notify_on_upload') == 'on'
    notify_on_analysis = request.form.get('notify_on_analysis') == 'on'
    notify_on_critical = request.form.get('notify_on_critical') == 'on'
    
    if discord_webhook:
        os.environ["DISCORD_WEBHOOK"] = discord_webhook
    
    log_activity('settings_change', {
        'type': 'notification_settings',
        'webhook_updated': bool(discord_webhook)
    })
    
    return jsonify({"success": True})

@app.route('/settings/appearance', methods=['POST'])
@login_required
def update_appearance_settings():
    data = request.json
    theme = data.get('theme')
    font_size = data.get('font_size')
    
    log_activity('settings_change', {
        'type': 'appearance_settings',
        'theme': theme,
        'font_size': font_size
    })
    
    return jsonify({"success": True})

@app.route('/settings')
@login_required
def get_settings():
    # Return current settings
    settings_data = {
        'api_settings': {
            'api_key': os.environ.get("API_KEY", ""),
            'threshold': 75
        },
        'notification_settings': {
            'discord_webhook': os.environ.get("DISCORD_WEBHOOK", ""),
            'notify_on_upload': True,
            'notify_on_analysis': True,
            'notify_on_critical': True
        },
        'appearance_settings': {
            'font_size': 14
        }
    }
    
    # Add search query if it exists in session
    if 'search_query' in session:
        settings_data['search_query'] = session.pop('search_query')  # Remove after use
    
    return jsonify(settings_data)

@app.route('/analyze', methods=['POST'])
@login_required
def analyze():
    try:
        # Handle both files and filenames
        log_files = request.files.getlist('log_files')
        log_filename = request.form.get('log_files')  # For when a filename is passed instead of a file
        format_type = request.form.get('format', 'html')
        search_query = request.form.get('search', '')
        
        # Get API key from form or environment
        api_key = request.form.get('api_key') or os.environ.get("API_KEY", "")
        
        # Get Discord webhook URL if provided
        discord_webhook = request.form.get('discord_webhook') or os.environ.get("DISCORD_WEBHOOK", "")

        if not api_key:
            flash("API key is missing. Please provide an API key or set it in the .env file.", "danger")
            return jsonify({"error": "API key is missing. Please provide an API key or set it in the .env file."}), 400
        
        # Ensure upload directory exists with proper permissions
        if not os.path.exists(UPLOAD_FOLDER):
            try:
                os.makedirs(UPLOAD_FOLDER)
            except Exception as e:
                app.logger.error(f"Failed to create upload directory: {str(e)}")
                flash(f"Failed to create upload directory: {str(e)}", "danger")
                return jsonify({"error": f"Failed to create upload directory: {str(e)}"}), 500
        
        # Check if we have write permission to the upload directory
        if not os.access(UPLOAD_FOLDER, os.W_OK):
            app.logger.error(f"No write permission to upload directory: {UPLOAD_FOLDER}")
            flash(f"No write permission to the upload directory", "danger")
            return jsonify({"error": f"No write permission to the upload directory: {UPLOAD_FOLDER}"}), 500
        
        results = []
        uploaded_files = []
        
        # Initialize the analyzer
        try:
            analyzer = LogAnalyzer(api_key)
        except Exception as e:
            app.logger.error(f"Failed to initialize log analyzer: {str(e)}")
            flash(f"Failed to initialize log analyzer: {str(e)}", "danger")
            return jsonify({"error": f"Failed to initialize log analyzer: {str(e)}"}), 500
        
        # Handle when log files are uploaded directly
        if log_files and log_files[0].filename:
            for log_file in log_files:
                if log_file.filename:
                    try:
                        # Sanitize filename to prevent path traversal
                        filename = os.path.basename(log_file.filename)
                        log_file_path = os.path.join(UPLOAD_FOLDER, filename)
                        
                        # Save the file
                        app.logger.info(f"Saving uploaded file to: {log_file_path}")
                        log_file.save(log_file_path)
                        uploaded_files.append(log_file_path)
                        
                        # Analyze the file
                        app.logger.info(f"Analyzing file: {log_file_path}")
                        file_results = analyzer.analyze_file(log_file_path)
                        results.extend(file_results)
                    except Exception as e:
                        app.logger.error(f"Error processing file {log_file.filename}: {str(e)}")
                        flash(f"Error processing file {log_file.filename}: {str(e)}", "danger")
                        return jsonify({"error": f"Error processing file {log_file.filename}: {str(e)}"}), 500
        # Handle when log filename is provided instead of file upload
        elif log_filename:
            log_file_path = os.path.join(UPLOAD_FOLDER, os.path.basename(log_filename))
            if os.path.exists(log_file_path):
                try:
                    uploaded_files.append(log_file_path)
                    app.logger.info(f"Analyzing file: {log_file_path}")
                    file_results = analyzer.analyze_file(log_file_path)
                    results.extend(file_results)
                except Exception as e:
                    app.logger.error(f"Error analyzing file {log_filename}: {str(e)}")
                    flash(f"Error analyzing file {log_filename}: {str(e)}", "danger")
                    return jsonify({"error": f"Error analyzing file {log_filename}: {str(e)}"}), 500
            else:
                flash(f"Log file not found: {log_filename}", "danger")
                return jsonify({"error": f"Log file not found: {log_filename}"}), 404
        else:
            flash("No log files uploaded or specified", "danger")
            return jsonify({"error": "No log files uploaded or specified"}), 400

        # Generate timestamp for unique report name
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f'{REPORTS_FOLDER}/report_{timestamp}.{format_type}'
        
        # Ensure reports directory exists
        if not os.path.exists(REPORTS_FOLDER):
            try:
                os.makedirs(REPORTS_FOLDER)
            except Exception as e:
                app.logger.error(f"Failed to create reports directory: {str(e)}")
                flash(f"Failed to create reports directory: {str(e)}", "danger")
                return jsonify({"error": f"Failed to create reports directory: {str(e)}"}), 500
        
        # Generate report
        try:
            generate_report(results, output_file, format_type)
        except Exception as e:
            app.logger.error(f"Failed to generate report: {str(e)}")
            flash(f"Failed to generate report: {str(e)}", "danger")
            return jsonify({"error": f"Failed to generate report: {str(e)}"}), 500
        
        # Return summary stats along with the report path
        severity_count = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for threat in results:
            severity = threat.get('severity', 'low')
            severity_count[severity] = severity_count.get(severity, 0) + 1
        
        result_data = {
            "message": "Analysis complete", 
            "output_file": output_file,
            "total_threats": len(results),
            "severity_count": severity_count,
            "analyzed_files": len(uploaded_files)
        }
        
        # Send Discord notification if webhook URL is provided
        if discord_webhook:
            try:
                # Create a URL that can be used to access the report
                server_name = request.host_url.rstrip('/')
                report_url = f"{server_name}/{output_file}"
                dashboard_url = f"{server_name}/"
                
                # Send the notification
                send_discord_notification(
                    discord_webhook, 
                    result_data, 
                    report_url,
                    dashboard_url
                )
            except Exception as e:
                app.logger.error(f"Error sending Discord notification: {str(e)}")
                # Don't fail the entire request if notification fails
        
        flash(f"Analysis complete. Found {len(results)} potential issues.", "success")
        return jsonify(result_data)
        
    except Exception as e:
        app.logger.error(f"Unexpected error in analyze route: {str(e)}")
        flash(f"An unexpected error occurred: {str(e)}", "danger")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/search_logs', methods=['POST'])
@login_required
def search_logs():
    try:
        search_query = request.form.get('query', '')
        severity_filter = request.form.get('severity', '')
        date_from = request.form.get('date_from', '')
        date_to = request.form.get('date_to', '')
        
        # Get API key from form or environment
        api_key = request.form.get('api_key') or os.environ.get("API_KEY", "")
        
        if not api_key:
            return jsonify({
                "results": [],
                "total": 0,
                "error": "API key is missing. Please provide an API key or set it in the .env file."
            }), 400
        
        results = []
        
        # Search through report files first
        report_files = []
        for ext in ['json', 'html', 'txt']:
            report_files.extend(glob.glob(f'{REPORTS_FOLDER}/*.{ext}'))
        
        # For JSON reports, we can parse and filter
        for report_file in report_files:
            try:
                with open(report_file, 'r') as f:
                    report_data = json.load(f)
                    
                    # Apply filters
                    filtered_threats = report_data.get('threats', [])
                    
                    if search_query:
                        search_terms = search_query.lower().split()
                        filtered_threats = [
                            t for t in filtered_threats 
                            if any(term in json.dumps(t).lower() for term in search_terms)
                        ]
                    
                    if severity_filter:
                        filtered_threats = [
                            t for t in filtered_threats 
                            if t.get('severity') == severity_filter.lower()
                        ]
                    
                    # Add to results
                    for threat in filtered_threats:
                        threat['report_file'] = report_file
                        threat['source_type'] = 'report'
                        results.append(threat)
            except Exception as e:
                print(f"Error reading report {report_file}: {str(e)}")
        
        # Now search directly through log files
        import re
        log_files = glob.glob(f'{UPLOAD_FOLDER}/*.log')
        log_search_options = {
            'keywords': search_query,
            'case_sensitive': request.form.get('case_sensitive', 'false').lower() == 'true',
            'regex': request.form.get('regex', 'false').lower() == 'true',
            'whole_word': request.form.get('whole_word', 'false').lower() == 'true',
            'log_level': request.form.get('log_level', '').upper(),
            'context_lines': int(request.form.get('context_lines', 0)),
            'max_results': int(request.form.get('max_results', 1000))
        }
        
        for log_file in log_files:
            try:
                file_basename = os.path.basename(log_file)
                match_count = 0
                
                # First, check if we want to search this file at all
                file_requested = request.form.get('filename', '')
                if file_requested and file_requested.lower() != file_basename.lower():
                    continue
                    
                with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                    log_content = f.readlines()
                    
                    # Skip if no search query for log files and no other filters
                    if not log_search_options['keywords'] and not log_search_options['log_level']:
                        continue
                    
                    # Prepare regex pattern if needed
                    pattern = None
                    if log_search_options['keywords']:
                        search_terms = log_search_options['keywords']
                        
                        if log_search_options['regex']:
                            try:
                                pattern = re.compile(search_terms, 0 if log_search_options['case_sensitive'] else re.IGNORECASE)
                            except re.error:
                                # If regex is invalid, fall back to normal search
                                pattern = None
                        
                    # Track context lines
                    context_lines = log_search_options['context_lines']
                    
                    # Search each line for matching terms
                    for i, line in enumerate(log_content):
                        matched = False
                        match_text = None
                        
                        # Check for log level match if specified
                        level_matched = True  # Default true if no log level specified
                        if log_search_options['log_level']:
                            level_matched = log_search_options['log_level'] in line.upper()
                        
                        # Check for keyword match if keywords provided
                        if log_search_options['keywords']:
                            if pattern:
                                # Use regex pattern
                                match = pattern.search(line)
                                matched = bool(match)
                                if matched:
                                    match_text = match.group(0)
                            elif log_search_options['whole_word']:
                                # Match whole words only
                                words = re.findall(r'\b\w+\b', line.lower() if not log_search_options['case_sensitive'] else line)
                                search_terms_list = search_terms.lower().split() if not log_search_options['case_sensitive'] else search_terms.split()
                                matched = any(term in words for term in search_terms_list)
                                match_text = line.strip()
                            else:
                                # Simple substring match
                                if log_search_options['case_sensitive']:
                                    matched = search_terms in line
                                else:
                                    matched = search_terms.lower() in line.lower()
                                match_text = line.strip()
                        
                        # If we have a match (both on keywords and log level if specified)
                        if matched and level_matched:
                            match_count += 1
                            
                            # Get context lines before
                            before_context = []
                            if context_lines > 0:
                                start_idx = max(0, i - context_lines)
                                before_context = log_content[start_idx:i]
                            
                            # Get context lines after
                            after_context = []
                            if context_lines > 0:
                                end_idx = min(len(log_content), i + context_lines + 1)
                                after_context = log_content[i+1:end_idx]
                            
                            # Extract timestamp if present in the line
                            timestamp = None
                            timestamp_match = re.search(r'\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}', line)
                            if timestamp_match:
                                timestamp = timestamp_match.group(0)
                            
                            # Create a "log entry" result
                            results.append({
                                'rule_id': 'LOG-MATCH',
                                'rule_name': f'Log Entry Match in {file_basename}',
                                'severity': 'info',
                                'line': line.strip(),
                                'line_num': i + 1,
                                'file': log_file,
                                'matched': match_text or line.strip(),
                                'timestamp': timestamp or datetime.datetime.now().isoformat(),
                                'description': f'Found matching log entry in file {file_basename}',
                                'remediation': 'Review the log entry for potential issues',
                                'report_file': None,
                                'source_type': 'log',
                                'context_before': [l.strip() for l in before_context],
                                'context_after': [l.strip() for l in after_context]
                            })
                            
                            # Check if we've hit the max results limit
                            if match_count >= log_search_options['max_results']:
                                break
                    
                    # Add a summary result if we had matches
                    if match_count > 0:
                        print(f"Found {match_count} matches in {file_basename}")
            except Exception as e:
                print(f"Error reading log file {log_file}: {str(e)}")
        
        # Sort results by severity and then by detection time (newest first)
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'info': 4}
        
        # Safe sorting function that handles invalid timestamps
        def sort_key(x):
            severity = severity_order.get(x.get('severity', 'low'), 5)
            
            # Default timestamp if not found or invalid
            timestamp_value = '2000-01-01T00:00:00'
            
            # Try detection_time first, then timestamp
            for key in ['detection_time', 'timestamp']:
                if key in x and x[key]:
                    try:
                        # Try to parse the timestamp - use the raw value if it works
                        timestamp_value = x[key]
                        # Just validate it parses correctly
                        datetime.datetime.fromisoformat(timestamp_value)
                        break
                    except (ValueError, TypeError):
                        # If parsing fails, continue to next timestamp field or use default
                        continue
            
            # Return tuple for sorting (severity first, then negative timestamp for descending order)
            try:
                return (severity, -float(datetime.datetime.fromisoformat(timestamp_value).timestamp()))
            except (ValueError, TypeError):
                # If all fails, use a very old timestamp value
                return (severity, float(datetime.datetime(2000, 1, 1).timestamp()))
        
        # Sort using the safe sort key function
        results.sort(key=sort_key)
        
        return jsonify({
            "results": results,
            "total": len(results)
        })
        
    except Exception as e:
        app.logger.error(f"Error in search_logs: {str(e)}", exc_info=True)
        return jsonify({
            "results": [],
            "total": 0,
            "error": f"An error occurred during search: {str(e)}"
        }), 500

@app.route('/search_logs_only', methods=['POST'])
@login_required
def search_logs_only():
    """Search through log files directly without requiring threat analysis"""
    search_query = request.form.get('query', '')
    
    # Get API key from form or environment
    api_key = request.form.get('api_key') or os.environ.get("API_KEY", "")
    
    if not api_key:
        return jsonify({
            "results": [],
            "total": 0,
            "error": "API key is missing. Please provide an API key or set it in the .env file."
        }), 400
    
    # Return early if no search query provided
    if not search_query:
        return jsonify({
            "results": [],
            "total": 0,
            "error": "Please provide a search query"
        }), 400
    
    # Get search options from the request
    log_search_options = {
        'keywords': search_query,
        'case_sensitive': request.form.get('case_sensitive', 'false').lower() == 'true',
        'regex': request.form.get('regex', 'false').lower() == 'true',
        'whole_word': request.form.get('whole_word', 'false').lower() == 'true',
        'log_level': request.form.get('log_level', '').upper(),
        'context_lines': int(request.form.get('context_lines', 0)),
        'max_results': int(request.form.get('max_results', 1000)),
        'filename': request.form.get('filename', '')
    }
    
    results = []
    
    # Get all log files in the uploads directory
    log_files = glob.glob(f'{UPLOAD_FOLDER}/*.log')
    if not log_files:
        return jsonify({
            "results": [],
            "total": 0,
            "message": "No log files available to search"
        })
    
    import re
    from datetime import datetime
    
    total_matches = 0
    searched_files = 0
    
    for log_file in log_files:
        try:
            file_basename = os.path.basename(log_file)
            
            # Filter by filename if specified
            if log_search_options['filename'] and log_search_options['filename'].lower() != file_basename.lower():
                continue
            
            searched_files += 1
            match_count = 0
            
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                log_content = f.readlines()
                
                # Prepare regex pattern if needed
                pattern = None
                if log_search_options['keywords']:
                    search_terms = log_search_options['keywords']
                    
                    if log_search_options['regex']:
                        try:
                            pattern = re.compile(search_terms, 0 if log_search_options['case_sensitive'] else re.IGNORECASE)
                        except re.error:
                            # If regex is invalid, fall back to normal search
                            pattern = None
                
                # Search each line for matching terms
                for i, line in enumerate(log_content):
                    matched = False
                    match_text = None
                    
                    # Check for log level match if specified
                    level_matched = True  # Default true if no log level specified
                    if log_search_options['log_level']:
                        level_matched = log_search_options['log_level'] in line.upper()
                    
                    # Check for keyword match
                    if pattern:
                        # Use regex pattern
                        match = pattern.search(line)
                        matched = bool(match)
                        if matched:
                            match_text = match.group(0)
                    elif log_search_options['whole_word']:
                        # Match whole words only
                        words = re.findall(r'\b\w+\b', line.lower() if not log_search_options['case_sensitive'] else line)
                        search_terms_list = search_terms.lower().split() if not log_search_options['case_sensitive'] else search_terms.split()
                        matched = any(term in words for term in search_terms_list)
                        match_text = line.strip()
                    else:
                        # Simple substring match
                        if log_search_options['case_sensitive']:
                            matched = search_terms in line
                        else:
                            matched = search_terms.lower() in line.lower()
                        match_text = line.strip()
                    
                    # If we have a match (both on keywords and log level if specified)
                    if matched and level_matched:
                        match_count += 1
                        total_matches += 1
                        
                        # Get context lines before
                        before_context = []
                        if log_search_options['context_lines'] > 0:
                            start_idx = max(0, i - log_search_options['context_lines'])
                            before_context = log_content[start_idx:i]
                        
                        # Get context lines after
                        after_context = []
                        if log_search_options['context_lines'] > 0:
                            end_idx = min(len(log_content), i + log_search_options['context_lines'] + 1)
                            after_context = log_content[i+1:end_idx]
                        
                        # Extract timestamp if present in the line
                        timestamp = None
                        timestamp_match = re.search(r'\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}', line)
                        if timestamp_match:
                            timestamp = timestamp_match.group(0)
                        
                        # Create a "log entry" result
                        results.append({
                            'rule_id': 'LOG-SEARCH',
                            'rule_name': f'Search Match in {file_basename}',
                            'severity': 'info',
                            'line': line.strip(),
                            'line_num': i + 1,
                            'file': log_file,
                            'matched': match_text or line.strip(),
                            'timestamp': timestamp or datetime.now().isoformat(),
                            'description': f'Found matching log entry in file {file_basename}',
                            'source_type': 'log',
                            'context_before': [l.strip() for l in before_context],
                            'context_after': [l.strip() for l in after_context]
                        })
                        
                        # Check if we've hit the max results limit
                        if total_matches >= log_search_options['max_results']:
                            break
                
            if match_count > 0:
                print(f"Found {match_count} matches in {file_basename}")
                
        except Exception as e:
            print(f"Error reading log file {log_file}: {str(e)}")
    
    return jsonify({
        "results": results,
        "total": total_matches,
        "files_searched": searched_files,
        "message": f"Found {total_matches} matches in {searched_files} files"
    })

# Add a route to list available log files
@app.route('/list_log_files', methods=['GET'])
@login_required
def list_log_files():
    """List all available log files in the uploads directory"""
    log_files = []
    for log_file in glob.glob(f'{UPLOAD_FOLDER}/*.log'):
        file_stats = os.stat(log_file)
        log_files.append({
            'filename': os.path.basename(log_file),
            'path': log_file,
            'size': file_stats.st_size,
            'created': datetime.datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
            'modified': datetime.datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
        })
    
    # Sort by creation time (newest first)
    log_files.sort(key=lambda x: x['created'], reverse=True)
    
    return jsonify({
        'log_files': log_files,
        'count': len(log_files)
    })

@app.route('/reports/<path:filename>')
@login_required
def get_report(filename):
    return send_file(os.path.join(REPORTS_FOLDER, filename))

@app.route('/dashboard_data')
@login_required
def dashboard_data():
    # Get latest stats from reports
    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    
    # Count the number of log files
    log_files = glob.glob(f'{UPLOAD_FOLDER}/*.log')
    log_count = len(log_files)
    
    # Count the total number of lines across all log files
    total_line_count = 0
    total_size = 0
    try:
        for log_file in log_files:
            # Add to total file size
            total_size += os.path.getsize(log_file)
            
            # Count lines in the file
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                total_line_count += sum(1 for _ in f)
    except Exception as e:
        app.logger.error(f"Error counting lines in log files: {str(e)}")
    
    # Count the number of reports
    report_files = []
    for ext in ['json', 'html', 'txt']:
        report_files.extend(glob.glob(f'{REPORTS_FOLDER}/*.{ext}'))
    report_count = len(report_files)
    
    # Get last analysis timestamp if any reports exist
    last_analysis = None
    if report_files:
        try:
            last_report = max(report_files, key=os.path.getctime)
            last_analysis = datetime.datetime.fromtimestamp(os.path.getctime(last_report)).isoformat()
        except:
            pass
    
    # Find the most recent report
    json_reports = glob.glob(f'{REPORTS_FOLDER}/*.json')
    if not json_reports:
        # No JSON reports, return default empty data with counts
        return jsonify({
            "threat_counts": severity_counts,
            "recent_threats": [],
            "time_series_data": [],
            "log_count": log_count,
            "report_count": report_count,
            "last_analysis": last_analysis,
            "source_ips": [],
            "dest_ips": [],
            "protocols": [],
            "total_line_count": total_line_count,
            "total_log_size": total_size
        })
    
    latest_report = max(json_reports, key=os.path.getctime)
    
    try:
        with open(latest_report, 'r') as f:
            report_data = json.load(f)
            
            # Get severity counts
            if 'summary' in report_data and 'by_severity' in report_data['summary']:
                severity_counts = report_data['summary']['by_severity']
            
            # Get recent threats (limit to 5)
            recent_threats = report_data.get('threats', [])[:5]
            
            # Generate time series data - ideally this would come from a database
            # or by analyzing multiple reports over time
            import random
            from datetime import datetime, timedelta
            
            today = datetime.now()
            time_series_data = []
            for i in range(7):
                date = (today - timedelta(days=i)).strftime('%Y-%m-%d')
                time_series_data.append({
                    "date": date,
                    "critical": random.randint(0, 3),
                    "high": random.randint(1, 5),
                    "medium": random.randint(3, 8),
                    "low": random.randint(5, 15)
                })
            
            # Extract or generate sample data for IP charts
            source_ips = []
            dest_ips = []
            protocols = []
            
            if 'network_stats' in report_data:
                source_ips = report_data['network_stats'].get('source_ips', [])
                dest_ips = report_data['network_stats'].get('dest_ips', [])
                protocols = report_data['network_stats'].get('protocols', [])
            else:
                # Generate sample data if not available
                sample_ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '8.8.8.8', '1.1.1.1']
                source_ips = [{"ip": ip, "count": random.randint(10, 100)} for ip in sample_ips[:5]]
                dest_ips = [{"ip": ip, "volume": random.randint(1024, 10240)} for ip in sample_ips[:5]]
                protocols = [
                    {"protocol": "HTTP", "count": random.randint(50, 200)},
                    {"protocol": "HTTPS", "count": random.randint(100, 300)},
                    {"protocol": "DNS", "count": random.randint(20, 100)},
                    {"protocol": "SSH", "count": random.randint(5, 50)},
                    {"protocol": "SMTP", "count": random.randint(10, 80)}
                ]
            
            # Get attack paths data - this analyzes which endpoints or paths
            # are most frequently targeted in the detected threats
            attack_paths = {}
            for threat in report_data.get('threats', []):
                # Try to extract paths from lines or matched content
                path = None
                if 'line' in threat:
                    # Look for common URI patterns
                    import re
                    uri_match = re.search(r'(\/[\w\-\/\.]+\.\w+)', threat['line'])
                    if uri_match:
                        path = uri_match.group(1)
                
                # If we found a path, count it
                if path:
                    if path in attack_paths:
                        attack_paths[path] += 1
                    else:
                        attack_paths[path] = 1
            
            # Convert to sorted list
            paths_data = [{"path": k, "count": v} for k, v in attack_paths.items()]
            paths_data = sorted(paths_data, key=lambda x: x["count"], reverse=True)[:5]
            
            return jsonify({
                "threat_counts": severity_counts,
                "recent_threats": recent_threats,
                "time_series_data": time_series_data,
                "attack_paths": paths_data,
                "log_count": log_count,
                "report_count": report_count,
                "last_analysis": last_analysis,
                "source_ips": source_ips,
                "dest_ips": dest_ips,
                "protocols": protocols,
                "total_line_count": total_line_count,
                "total_log_size": total_size
            })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "threat_counts": severity_counts,
            "recent_threats": [],
            "time_series_data": [],
            "log_count": log_count,
            "report_count": report_count,
            "last_analysis": last_analysis,
            "source_ips": [],
            "dest_ips": [],
            "protocols": [],
            "total_line_count": total_line_count,
            "total_log_size": total_size
        })

# Add a route to list all available reports
@app.route('/reports_list')
@login_required
def list_reports_api():
    reports = []
    for ext in ['json', 'html', 'txt']:
        for report_file in glob.glob(f'{REPORTS_FOLDER}/*.{ext}'):
            file_stats = os.stat(report_file)
            reports.append({
                'filename': os.path.basename(report_file),
                'path': report_file,
                'size': file_stats.st_size,
                'created': datetime.datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                'modified': datetime.datetime.fromtimestamp(file_stats.st_mtime).isoformat(),
                'type': ext
            })
    
    # Sort by creation time (newest first)
    reports.sort(key=lambda x: x['created'], reverse=True)
    return jsonify({'reports': reports})

# Add a route to get report content directly (for preview)
@app.route('/preview_report/<path:filename>')
@login_required
def preview_report(filename):
    file_path = os.path.join(REPORTS_FOLDER, filename)
    
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404
    
    try:
        # Determine content type based on file extension
        file_ext = os.path.splitext(filename)[1].lower()
        
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # For JSON files, try to parse and then re-format for better viewing
        if file_ext == '.json':
            try:
                json_data = json.loads(content)
                content = json.dumps(json_data, indent=2)
                return content, 200, {'Content-Type': 'application/json'}
            except json.JSONDecodeError as e:
                return jsonify({"error": f"Invalid JSON format: {str(e)}"}), 400
        
        # For HTML files, return with proper content type
        elif file_ext == '.html':
            return content, 200, {'Content-Type': 'text/html'}
        
        # Default return as plain text
        return content, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        print(f"Error reading report file: {str(e)}")
        return jsonify({"error": f"Error reading file: {str(e)}"}), 500

# Add a route for previewing log files
@app.route('/preview_log/<path:filename>')
@login_required
def preview_log(filename):
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    
    if not os.path.exists(file_path):
        return jsonify({"error": "Log file not found"}), 404
    
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        return content, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        return jsonify({"error": f"Error reading log file: {str(e)}"}), 500

# Add a route to get report metadata for HTML reports
@app.route('/report_metadata/<path:filename>')
@login_required
def report_metadata(filename):
    # Generate metadata about the report
    try:
        # For HTML reports, extract metadata from corresponding JSON if exists
        base_name = os.path.splitext(filename)[0]
        json_file = f"{base_name}.json"
        json_path = os.path.join(REPORTS_FOLDER, json_file)
        
        if os.path.exists(json_path):
            with open(json_path, 'r') as f:
                metadata = json.load(f)
                return jsonify(metadata)
        
        # If no JSON exists, return minimal metadata
        return jsonify({
            "timestamp": datetime.datetime.now().isoformat(),
            "total_threats": 0,
            "severity_counts": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
                "info": 0
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/admin/system_settings')
@login_required
def get_system_settings():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    # Default settings for demonstration
    settings = {
        'log_retention_days': 30,
        'report_retention_days': 90,
        'max_log_file_size': 100,
        'log_user_login': True,
        'log_file_upload': True,
        'log_analysis': True,
        'log_settings_change': True
    }
    
    return jsonify({"settings": settings, "success": True})

@app.route('/admin/system_settings', methods=['POST'])
@login_required
def update_system_settings():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    # In a real implementation, you would save these to a configuration file or database
    # For this demo, we'll just return success
    return jsonify({"success": True})

@app.route('/admin/users/<user_id>/edit', methods=['POST'])
@login_required
def edit_user(user_id):
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    user = users.get(user_id)
    if not user:
        return jsonify({"error": "User not found", "success": False}), 404
    
    username = request.form.get('username')
    email = request.form.get('email')
    role = request.form.get('role')
    status = request.form.get('status')
    reset_password = request.form.get('reset_password') == 'on'
    
    # Update user fields
    user.email = email
    user.is_admin = (role == 'admin')
    user.status = status
    
    # Update password if reset requested
    if reset_password:
        new_password = request.form.get('new_password')
        if new_password:
            user.password = new_password
    
    return jsonify({"success": True})

@app.route('/admin/users/<user_id>/delete', methods=['POST'])
@login_required
def delete_user(user_id):
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    if user_id in users:
        # Don't allow admin to delete self
        if users[user_id] == current_user:
            return jsonify({"error": "Cannot delete yourself", "success": False}), 400
        
        del users[user_id]
        return jsonify({"success": True})
    
    return jsonify({"error": "User not found", "success": False}), 404

@app.route('/admin/activity_logs/export')
@login_required
def export_activity_logs():
    if not current_user.is_admin:
        return jsonify({"error": "Access denied"}), 403
    
    # Generate CSV content
    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['Timestamp', 'Username', 'Activity Type', 'IP Address', 'Details'])
    
    logs = []
    filter_type = request.args.get('filter', 'all')
    
    if os.path.exists(ACTIVITY_LOGS_FILE):
        with open(ACTIVITY_LOGS_FILE, 'r') as f:
            logs = json.load(f)
    
    # Apply filter
    if filter_type != 'all':
        logs = [log for log in logs if log.get('activity_type') == filter_type]
    
    for log in logs:
        writer.writerow([
            log.get('timestamp', ''),
            log.get('username', ''),
            log.get('activity_type', ''),
            log.get('ip_address', ''),
            json.dumps(log.get('details', {}))
        ])
    
    # Return CSV file
    output.seek(0)
    return output.getvalue(), 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': f'attachment; filename=activity_logs_{datetime.datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    }

# Add a dedicated route for uploading log files
@app.route('/upload_logs', methods=['POST'])
@login_required
def upload_logs():
    try:
        # Check if files were included in the request
        if 'log_files' not in request.files:
            flash("No files uploaded", "warning")
            return jsonify({"error": "No files uploaded"}), 400
        
        log_files = request.files.getlist('log_files')
        
        # Check if any files were selected
        if not log_files or log_files[0].filename == '':
            flash("No files selected", "warning")
            return jsonify({"error": "No files selected"}), 400
        
        # Ensure upload directory exists with proper permissions
        if not os.path.exists(UPLOAD_FOLDER):
            try:
                os.makedirs(UPLOAD_FOLDER)
            except Exception as e:
                app.logger.error(f"Failed to create upload directory: {str(e)}")
                flash(f"Failed to create upload directory: {str(e)}", "danger")
                return jsonify({"error": f"Failed to create upload directory: {str(e)}"}), 500
        
        # Check if we have write permission to the upload directory
        if not os.access(UPLOAD_FOLDER, os.W_OK):
            app.logger.error(f"No write permission to upload directory: {UPLOAD_FOLDER}")
            flash(f"No write permission to the upload directory", "danger")
            return jsonify({"error": f"No write permission to the upload directory: {UPLOAD_FOLDER}"}), 500
        
        uploaded_files = []
        
        # Process each uploaded file
        for log_file in log_files:
            if log_file and log_file.filename:
                try:
                    # Sanitize filename to prevent path traversal
                    filename = os.path.basename(log_file.filename)
                    log_file_path = os.path.join(UPLOAD_FOLDER, filename)
                    
                    # Save the file
                    app.logger.info(f"Saving uploaded file to: {log_file_path}")
                    log_file.save(log_file_path)
                    
                    # Get file stats
                    file_stats = os.stat(log_file_path)
                    
                    # Add to the list of uploaded files
                    uploaded_files.append({
                        'filename': filename,
                        'path': log_file_path,
                        'size': file_stats.st_size,
                        'created': datetime.datetime.fromtimestamp(file_stats.st_ctime).isoformat()
                    })
                    
                    # Log the activity
                    log_activity('file_upload', {
                        'filename': filename,
                        'size': file_stats.st_size
                    })
                except Exception as e:
                    app.logger.error(f"Error processing file {log_file.filename}: {str(e)}")
                    flash(f"Error processing file {log_file.filename}: {str(e)}", "danger")
                    return jsonify({"error": f"Error processing file {log_file.filename}: {str(e)}"}), 500
        
        flash(f"Successfully uploaded {len(uploaded_files)} file(s)", "success")
        return jsonify({
            "success": True,
            "message": f"Successfully uploaded {len(uploaded_files)} file(s)",
            "files": uploaded_files
        })
    except Exception as e:
        app.logger.error(f"Unexpected error during file upload: {str(e)}")
        flash(f"An unexpected error occurred: {str(e)}", "danger")
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/report_preview/<path:filename>')
@login_required
def report_preview_page(filename):
    """Render the report preview page for the specified report"""
    # Check if file exists
    file_path = os.path.join(REPORTS_FOLDER, filename)
    if not os.path.exists(file_path):
        flash("Report not found", "danger")
        return redirect(url_for('reports'))
        
    # Log activity
    log_activity('view_report', {
        'filename': filename,
        'method': 'preview_page'
    })
    
    return render_template('report_preview.html', report_id=filename)

@app.route('/search')
@login_required
def search():
    """Handle GET requests to /search and render the search page"""
    query = request.args.get('query', '')
    
    # Store the search query in session for backward compatibility
    if query:
        session['search_query'] = query
    
    # Render the dedicated search page with the query
    return render_template('search.html', query=query)

if __name__ == '__main__':
    app.run(debug=True)
