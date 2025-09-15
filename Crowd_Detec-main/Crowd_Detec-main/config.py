"""
Configuration management for AI Crowd Detection Model
"""

import yaml
import os
from pathlib import Path
from typing import Dict, Any, Union
import logging

class Config:
    """Configuration manager for the crowd detection system"""
    
    def __init__(self, config_path: str = "config.yaml"):
        """
        Initialize configuration manager
        
        Args:
            config_path: Path to YAML configuration file
        """
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self._setup_directories()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file"""
        try:
            with open(self.config_path, 'r') as file:
                config = yaml.safe_load(file)
            return config
        except FileNotFoundError:
            logging.error(f"Configuration file {self.config_path} not found")
            return self._get_default_config()
        except yaml.YAMLError as e:
            logging.error(f"Error parsing configuration file: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Return default configuration if file is not found"""
        return {
            'model': {
                'confidence_threshold': 0.5,
                'device': 'auto',
                'model_path': 'yolov8n.pt',
                'input_size': 640,
                'max_det': 300
            },
            'video': {
                'input_source': 0,
                'display_output': True,
                'save_output': False,
                'output_path': 'output/',
                'target_fps': 30,
                'resize_width': 1280,
                'resize_height': 720
            },
            'crowd_analysis': {
                'density_calculation': 'bbox_coverage',
                'smoothing_factor': 0.3,
                'alert_thresholds': {'low': 20, 'medium': 50, 'high': 100},
                'density_grid_size': [10, 10]
            },
            'logging': {
                'enable': True,
                'format': 'csv',
                'log_interval': 5,
                'log_path': 'logs/',
                'save_images': False,
                'image_interval': 30
            },
            'alerts': {
                'enable': True,
                'email_notifications': False,
                'console_output': True,
                'sound_alerts': False
            },
            'performance': {
                'batch_size': 1,
                'half_precision': False,
                'multi_threading': True,
                'max_workers': 4
            }
        }
    
    def _setup_directories(self):
        """Create necessary directories"""
        directories = [
            self.config['video']['output_path'],
            self.config['logging']['log_path'],
            'models/',
            'test_data/',
            'temp/'
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    def get(self, key_path: str, default: Any = None) -> Any:
        """
        Get configuration value using dot notation
        
        Args:
            key_path: Dot-separated path to configuration value (e.g., 'model.confidence_threshold')
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        keys = key_path.split('.')
        value = self.config
        
        try:
            for key in keys:
                value = value[key]
            return value
        except (KeyError, TypeError):
            return default
    
    def set(self, key_path: str, value: Any):
        """
        Set configuration value using dot notation
        
        Args:
            key_path: Dot-separated path to configuration value
            value: Value to set
        """
        keys = key_path.split('.')
        config = self.config
        
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]
        
        config[keys[-1]] = value
    
    def save(self, file_path: str = None):
        """
        Save current configuration to file
        
        Args:
            file_path: Optional custom file path
        """
        save_path = Path(file_path) if file_path else self.config_path
        
        with open(save_path, 'w') as file:
            yaml.dump(self.config, file, default_flow_style=False, indent=2)
    
    def update_from_dict(self, updates: Dict[str, Any]):
        """
        Update configuration from dictionary
        
        Args:
            updates: Dictionary with configuration updates
        """
        def deep_update(base_dict, update_dict):
            for key, value in update_dict.items():
                if isinstance(value, dict) and key in base_dict:
                    deep_update(base_dict[key], value)
                else:
                    base_dict[key] = value
        
        deep_update(self.config, updates)
    
    def validate(self) -> bool:
        """
        Validate configuration values
        
        Returns:
            True if configuration is valid, False otherwise
        """
        required_sections = ['model', 'video', 'crowd_analysis', 'logging']
        
        for section in required_sections:
            if section not in self.config:
                logging.error(f"Missing required configuration section: {section}")
                return False
        
        # Validate specific values
        if not 0 <= self.config['model']['confidence_threshold'] <= 1:
            logging.error("Confidence threshold must be between 0 and 1")
            return False
        
        if self.config['video']['target_fps'] <= 0:
            logging.error("Target FPS must be positive")
            return False
        
        return True
    
    def __getitem__(self, key):
        """Enable dictionary-style access"""
        return self.config[key]
    
    def __setitem__(self, key, value):
        """Enable dictionary-style assignment"""
        self.config[key] = value


# Global configuration instance
config = Config()