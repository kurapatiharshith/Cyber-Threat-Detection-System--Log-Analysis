# Log Analyzer & Security Dashboard

A comprehensive web application for analyzing log files, detecting security threats, and generating detailed reports. This tool helps security professionals and system administrators identify potential security issues in their log files using advanced analysis techniques.

## Features

- **Log File Management**: Upload, view, and manage log files
- **Automated Analysis**: Analyze log files for security threats using AI-powered detection
- **Detailed Reports**: Generate comprehensive reports in multiple formats (HTML, JSON, TXT)
- **Advanced Search**: Search through logs and reports with regex support and filtering options
- **Real-time Dashboard**: View security insights with interactive charts and visualizations
- **User Management**: Admin interface for managing users and permissions
- **Activity Tracking**: Record and monitor user activities for audit purposes
- **Discord Notifications**: Optional webhook integration for real-time security alerts
- **Responsive Design**: Works on desktop and mobile devices

## Installation

### Prerequisites

- Python 3.8+
- Flask
- pip (Python package manager)

### Setup

1. Clone the repository:

```bash
git https://github.com/VASVIjs124/Cyber-Threat-Detection-System--Log-Analysis-.git
cd log-analyzer
```

2. Create and activate a virtual environment:

```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

3. Install the required dependencies:

```bash
pip install -r requirements.txt
```

4. Set up the environment variables (or create a .env file):

```
API_KEY=your_huggingface_api_key
DISCORD_WEBHOOK=your_discord_webhook_url
SECRET_KEY=your_secret_key_for_flask
```

## Usage

1. Start the application:

```bash
python app.py
```

2. Open your web browser and navigate to `http://localhost:5000`

3. Login with the default credentials: (Remember to change the deafult credentials after first login)
   - Username: admin
   - Password: admin123

4. Upload log files through the dashboard or logs page

5. Analyze logs and view generated reports

## Configuration

### API Key

The application uses the HuggingFace API for enhanced log analysis. You can set your API key in:
- The `.env` file
- The settings page in the web interface
- As a parameter when analyzing logs

### Discord Notifications

Set up Discord notifications for real-time alerts:
1. Create a webhook URL in your Discord server
2. Add the URL to the `.env` file or settings page
3. Configure notification preferences in the settings page

## Project Structure

```
log-analyzer/
├── app.py                  # Main Flask application
├── analyzer.py             # Log analysis logic
├── report_generator.py     # Report generation utilities
├── alert.py                # Notification handling
├── static/                 # Static assets (JS, CSS, images)
│   ├── css/
│   ├── js/
│   └── img/
├── templates/              # HTML templates
├── uploads/                # Uploaded log files
├── reports/                # Generated reports
└── requirements.txt        # Python dependencies
```

## Security Considerations

- Change the default admin password immediately after first login
- Use HTTPS in production environments
- Regularly backup your database and reports
- Limit access to the admin interface

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
