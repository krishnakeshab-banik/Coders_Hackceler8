"""
Alert Management System for AI Crowd Detection
Handles threshold-based alerts, notifications, and logging
"""

import smtplib
import logging
import time
import json
import csv
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import config


class AlertManager:
    """Manages alerts, notifications, and logging for crowd detection"""
    
    def __init__(self):
        """Initialize alert manager"""
        self.alert_config = config.get('alerts', {})
        self.logging_config = config.get('logging', {})
        self.thresholds = config.get('crowd_analysis.alert_thresholds', {
            'low': 20, 'medium': 50, 'high': 100
        })
        
        # Alert state tracking
        self.current_alert_level = 'none'
        self.last_alert_time = {}
        self.alert_cooldown = 60  # seconds between same-level alerts
        self.active_alerts = set()
        
        # Logging setup
        self.log_enabled = self.logging_config.get('enable', True)
        self.log_format = self.logging_config.get('format', 'csv')
        self.log_path = Path(self.logging_config.get('log_path', 'logs/'))
        self.log_interval = self.logging_config.get('log_interval', 5)
        self.last_log_time = 0
        
        # Email configuration
        self.email_enabled = self.alert_config.get('email_notifications', False)
        self.email_config = self.alert_config.get('email_config', {})
        
        # Console and sound alerts
        self.console_output = self.alert_config.get('console_output', True)
        self.sound_alerts = self.alert_config.get('sound_alerts', False)
        
        # Image saving
        self.save_images = self.logging_config.get('save_images', False)
        self.image_interval = self.logging_config.get('image_interval', 30)
        self.last_image_save = 0
        
        self._setup_logging()
        self._ensure_directories()
        self._setup_log_files()
    
    def _setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def _ensure_directories(self):
        """Ensure necessary directories exist"""
        self.log_path.mkdir(parents=True, exist_ok=True)
        if self.save_images:
            (self.log_path / 'images').mkdir(parents=True, exist_ok=True)
    
    def _setup_log_files(self):
        """Setup log files with headers"""
        if not self.log_enabled:
            return
        
        current_date = datetime.now().strftime('%Y%m%d')
        
        if self.log_format == 'csv':
            self.log_file = self.log_path / f'crowd_detection_{current_date}.csv'
            
            # Create CSV header if file doesn't exist
            if not self.log_file.exists():
                with open(self.log_file, 'w', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow([
                        'timestamp', 'datetime', 'person_count', 'smoothed_count',
                        'density_score', 'smoothed_density', 'crowd_level',
                        'alert_level', 'center_of_mass_x', 'center_of_mass_y',
                        'spread', 'clustering_score', 'edge_density',
                        'count_trend', 'density_trend', 'anomalies'
                    ])
        
        elif self.log_format == 'json':
            self.log_file = self.log_path / f'crowd_detection_{current_date}.json'
            
            # Initialize JSON file as array if doesn't exist
            if not self.log_file.exists():
                with open(self.log_file, 'w') as f:
                    json.dump([], f)
    
    def check_alerts(self, analysis_results: Dict) -> Dict:
        """
        Check for alert conditions and trigger notifications
        
        Args:
            analysis_results: Results from crowd analysis
            
        Returns:
            Alert status and actions taken
        """
        current_time = time.time()
        person_count = analysis_results.get('smoothed_count', 0)
        crowd_level = analysis_results.get('crowd_level', 'low')
        anomalies = analysis_results.get('anomalies', {})
        
        alert_info = {
            'alert_triggered': False,
            'alert_level': 'none',
            'alert_type': 'none',
            'message': '',
            'actions_taken': []
        }
        
        # Check threshold-based alerts
        threshold_alert = self._check_threshold_alerts(person_count, crowd_level, current_time)
        
        # Check anomaly-based alerts
        anomaly_alert = self._check_anomaly_alerts(anomalies, current_time)
        
        # Determine primary alert
        if threshold_alert['alert_triggered'] or anomaly_alert['alert_triggered']:
            alert_info['alert_triggered'] = True
            
            # Prioritize threshold alerts over anomaly alerts
            if threshold_alert['alert_triggered']:
                alert_info.update(threshold_alert)
            else:
                alert_info.update(anomaly_alert)
            
            # Execute alert actions
            self._execute_alert_actions(alert_info, analysis_results)
        
        # Update current state
        self.current_alert_level = alert_info['alert_level']
        
        return alert_info
    
    def _check_threshold_alerts(self, person_count: float, crowd_level: str, current_time: float) -> Dict:
        """Check for threshold-based alerts"""
        alert_info = {
            'alert_triggered': False,
            'alert_level': 'none',
            'alert_type': 'threshold',
            'message': '',
            'actions_taken': []
        }
        
        # Determine alert level based on crowd level
        if crowd_level in ['high', 'critical']:
            alert_level = crowd_level
            
            # Check cooldown
            if self._check_alert_cooldown(alert_level, current_time):
                alert_info['alert_triggered'] = True
                alert_info['alert_level'] = alert_level
                alert_info['message'] = f"{alert_level.title()} crowd density detected: {person_count:.1f} people"
                
                # Update last alert time
                self.last_alert_time[alert_level] = current_time
        
        return alert_info
    
    def _check_anomaly_alerts(self, anomalies: Dict, current_time: float) -> Dict:
        """Check for anomaly-based alerts"""
        alert_info = {
            'alert_triggered': False,
            'alert_level': 'anomaly',
            'alert_type': 'anomaly',
            'message': '',
            'actions_taken': []
        }
        
        detected_anomalies = []
        for anomaly_type, detected in anomalies.items():
            if detected:
                detected_anomalies.append(anomaly_type.replace('_', ' '))
        
        if detected_anomalies and self._check_alert_cooldown('anomaly', current_time):
            alert_info['alert_triggered'] = True
            alert_info['message'] = f"Anomaly detected: {', '.join(detected_anomalies)}"
            self.last_alert_time['anomaly'] = current_time
        
        return alert_info
    
    def _check_alert_cooldown(self, alert_level: str, current_time: float) -> bool:
        """Check if enough time has passed since last alert of this level"""
        if alert_level not in self.last_alert_time:
            return True
        
        time_since_last = current_time - self.last_alert_time[alert_level]
        return time_since_last >= self.alert_cooldown
    
    def _execute_alert_actions(self, alert_info: Dict, analysis_results: Dict):
        """Execute alert actions based on configuration"""
        actions_taken = []
        
        # Console output
        if self.console_output:
            self._print_console_alert(alert_info, analysis_results)
            actions_taken.append('console_output')
        
        # Email notification
        if self.email_enabled:
            success = self._send_email_alert(alert_info, analysis_results)
            if success:
                actions_taken.append('email_sent')
            else:
                actions_taken.append('email_failed')
        
        # Sound alert (placeholder - would need platform-specific implementation)
        if self.sound_alerts:
            self._play_sound_alert(alert_info)
            actions_taken.append('sound_alert')
        
        alert_info['actions_taken'] = actions_taken
    
    def _print_console_alert(self, alert_info: Dict, analysis_results: Dict):
        """Print alert to console"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"\n{'='*60}")
        print(f"CROWD ALERT - {timestamp}")
        print(f"{'='*60}")
        print(f"Alert Level: {alert_info['alert_level'].upper()}")
        print(f"Alert Type: {alert_info['alert_type'].upper()}")
        print(f"Message: {alert_info['message']}")
        print(f"Person Count: {analysis_results.get('person_count', 0)}")
        print(f"Smoothed Count: {analysis_results.get('smoothed_count', 0):.1f}")
        print(f"Density Score: {analysis_results.get('density_score', 0):.3f}")
        print(f"Crowd Level: {analysis_results.get('crowd_level', 'unknown').upper()}")
        
        # Display trends if available
        trends = analysis_results.get('trends', {})
        if trends:
            print(f"Count Trend: {trends.get('count_trend', 'unknown')}")
            print(f"Density Trend: {trends.get('density_trend', 'unknown')}")
        
        print(f"{'='*60}\n")
    
    def _send_email_alert(self, alert_info: Dict, analysis_results: Dict) -> bool:
        """Send email alert"""
        try:
            if not self.email_config.get('smtp_server') or not self.email_config.get('recipients'):
                self.logger.warning("Email configuration incomplete, skipping email alert")
                return False
            
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.email_config['username']
            msg['To'] = ', '.join(self.email_config['recipients'])
            msg['Subject'] = f"Crowd Alert - {alert_info['alert_level'].title()}"
            
            # Create email body
            body = self._create_email_body(alert_info, analysis_results)
            msg.attach(MIMEText(body, 'html'))
            
            # Send email
            with smtplib.SMTP(self.email_config['smtp_server'], self.email_config.get('smtp_port', 587)) as server:
                server.starttls()
                server.login(self.email_config['username'], self.email_config['password'])
                server.send_message(msg)
            
            self.logger.info("Email alert sent successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to send email alert: {e}")
            return False
    
    def _create_email_body(self, alert_info: Dict, analysis_results: Dict) -> str:
        """Create HTML email body"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        html = f"""
        <html>
        <body>
            <h2>Crowd Detection Alert</h2>
            <p><strong>Timestamp:</strong> {timestamp}</p>
            <p><strong>Alert Level:</strong> <span style="color: red;">{alert_info['alert_level'].upper()}</span></p>
            <p><strong>Message:</strong> {alert_info['message']}</p>
            
            <h3>Crowd Metrics</h3>
            <ul>
                <li><strong>Person Count:</strong> {analysis_results.get('person_count', 0)}</li>
                <li><strong>Smoothed Count:</strong> {analysis_results.get('smoothed_count', 0):.1f}</li>
                <li><strong>Density Score:</strong> {analysis_results.get('density_score', 0):.3f}</li>
                <li><strong>Crowd Level:</strong> {analysis_results.get('crowd_level', 'unknown').upper()}</li>
            </ul>
            
            <h3>Spatial Analysis</h3>
        """
        
        spatial = analysis_results.get('spatial_analysis', {})
        if spatial:
            html += f"""
            <ul>
                <li><strong>Center of Mass:</strong> ({spatial.get('center_of_mass', [0, 0])[0]:.1f}, {spatial.get('center_of_mass', [0, 0])[1]:.1f})</li>
                <li><strong>Spread:</strong> {spatial.get('spread', 0):.2f}</li>
                <li><strong>Clustering Score:</strong> {spatial.get('clustering_score', 0):.3f}</li>
                <li><strong>Edge Density:</strong> {spatial.get('edge_density', 0):.3f}</li>
            </ul>
            """
        
        trends = analysis_results.get('trends', {})
        if trends:
            html += f"""
            <h3>Trends</h3>
            <ul>
                <li><strong>Count Trend:</strong> {trends.get('count_trend', 'unknown')}</li>
                <li><strong>Density Trend:</strong> {trends.get('density_trend', 'unknown')}</li>
            </ul>
            """
        
        html += """
        </body>
        </html>
        """
        
        return html
    
    def _play_sound_alert(self, alert_info: Dict):
        """Play sound alert (placeholder implementation)"""
        # This would be platform-specific implementation
        # For Windows: could use winsound
        # For Linux: could use pygame or system beep
        # For now, just log
        self.logger.info(f"Sound alert triggered for {alert_info['alert_level']}")
    
    def log_data(self, analysis_results: Dict, alert_info: Dict = None):
        """
        Log crowd analysis data
        
        Args:
            analysis_results: Results from crowd analysis
            alert_info: Alert information (optional)
        """
        if not self.log_enabled:
            return
        
        current_time = time.time()
        
        # Check if enough time has passed since last log
        if current_time - self.last_log_time < self.log_interval:
            return
        
        self.last_log_time = current_time
        
        # Log data based on format
        if self.log_format == 'csv':
            self._log_csv(analysis_results, alert_info, current_time)
        elif self.log_format == 'json':
            self._log_json(analysis_results, alert_info, current_time)
    
    def _log_csv(self, analysis_results: Dict, alert_info: Dict, timestamp: float):
        """Log data in CSV format"""
        try:
            spatial = analysis_results.get('spatial_analysis', {})
            trends = analysis_results.get('trends', {})
            anomalies = analysis_results.get('anomalies', {})
            
            with open(self.log_file, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp,
                    datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S'),
                    analysis_results.get('person_count', 0),
                    analysis_results.get('smoothed_count', 0),
                    analysis_results.get('density_score', 0),
                    analysis_results.get('smoothed_density', 0),
                    analysis_results.get('crowd_level', 'unknown'),
                    alert_info.get('alert_level', 'none') if alert_info else 'none',
                    spatial.get('center_of_mass', [0, 0])[0],
                    spatial.get('center_of_mass', [0, 0])[1],
                    spatial.get('spread', 0),
                    spatial.get('clustering_score', 0),
                    spatial.get('edge_density', 0),
                    trends.get('count_trend', 'unknown'),
                    trends.get('density_trend', 'unknown'),
                    json.dumps(anomalies)
                ])
        except Exception as e:
            self.logger.error(f"Error logging CSV data: {e}")
    
    def _log_json(self, analysis_results: Dict, alert_info: Dict, timestamp: float):
        """Log data in JSON format"""
        try:
            # Read existing data
            with open(self.log_file, 'r') as f:
                data = json.load(f)
            
            # Add new entry
            entry = {
                'timestamp': timestamp,
                'datetime': datetime.fromtimestamp(timestamp).isoformat(),
                'analysis_results': analysis_results,
                'alert_info': alert_info
            }
            data.append(entry)
            
            # Write back to file
            with open(self.log_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            self.logger.error(f"Error logging JSON data: {e}")
    
    def save_alert_image(self, frame, alert_info: Dict):
        """
        Save image during alert conditions
        
        Args:
            frame: Current frame
            alert_info: Alert information
        """
        if not self.save_images:
            return
        
        current_time = time.time()
        
        # Check interval
        if current_time - self.last_image_save < self.image_interval:
            return
        
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            alert_level = alert_info.get('alert_level', 'unknown')
            filename = f"alert_{alert_level}_{timestamp}.jpg"
            image_path = self.log_path / 'images' / filename
            
            # Save image
            import cv2
            success = cv2.imwrite(str(image_path), frame)
            
            if success:
                self.logger.info(f"Alert image saved: {filename}")
                self.last_image_save = current_time
            else:
                self.logger.error(f"Failed to save alert image: {filename}")
                
        except Exception as e:
            self.logger.error(f"Error saving alert image: {e}")
    
    def get_alert_statistics(self) -> Dict:
        """Get alert system statistics"""
        return {
            'current_alert_level': self.current_alert_level,
            'alert_cooldown': self.alert_cooldown,
            'email_enabled': self.email_enabled,
            'console_output': self.console_output,
            'logging_enabled': self.log_enabled,
            'log_format': self.log_format,
            'last_alert_times': dict(self.last_alert_time),
            'thresholds': self.thresholds
        }
    
    def update_thresholds(self, new_thresholds: Dict):
        """
        Update alert thresholds
        
        Args:
            new_thresholds: Dictionary with new threshold values
        """
        self.thresholds.update(new_thresholds)
        self.logger.info(f"Alert thresholds updated: {self.thresholds}")
    
    def reset_alert_state(self):
        """Reset alert state (useful for testing)"""
        self.current_alert_level = 'none'
        self.last_alert_time.clear()
        self.active_alerts.clear()
        self.logger.info("Alert state reset")


def test_alert_manager():
    """Test function for alert manager"""
    print("Testing Alert Manager...")
    
    try:
        alert_manager = AlertManager()
        
        # Test data
        test_analysis = {
            'person_count': 75,
            'smoothed_count': 72.5,
            'density_score': 0.65,
            'smoothed_density': 0.63,
            'crowd_level': 'high',
            'spatial_analysis': {
                'center_of_mass': [320, 240],
                'spread': 45.2,
                'clustering_score': 0.7,
                'edge_density': 0.2
            },
            'trends': {
                'count_trend': 'increasing',
                'density_trend': 'stable'
            },
            'anomalies': {
                'count_anomaly': False,
                'density_anomaly': True,
                'sudden_change': False
            }
        }
        
        # Test alert checking
        alert_info = alert_manager.check_alerts(test_analysis)
        print(f"Alert info: {alert_info}")
        
        # Test logging
        alert_manager.log_data(test_analysis, alert_info)
        
        # Get statistics
        stats = alert_manager.get_alert_statistics()
        print(f"Alert statistics: {stats}")
        
        print("Alert Manager test completed successfully!")
        
    except Exception as e:
        print(f"Error testing alert manager: {e}")


if __name__ == "__main__":
    test_alert_manager()