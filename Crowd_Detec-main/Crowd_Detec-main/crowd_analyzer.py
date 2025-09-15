"""
Crowd Analytics Module for AI Crowd Detection
Handles crowd density calculation, person counting, and spatial analysis
"""

import numpy as np
import cv2
import logging
import time
from typing import List, Dict, Tuple, Optional
from collections import deque
from scipy.spatial.distance import cdist
from config import config


class CrowdAnalyzer:
    """Advanced crowd analysis and density calculation"""
    
    def __init__(self):
        """Initialize crowd analyzer"""
        self.density_method = config.get('crowd_analysis.density_calculation', 'bbox_coverage')
        self.smoothing_factor = config.get('crowd_analysis.smoothing_factor', 0.3)
        self.grid_size = config.get('crowd_analysis.density_grid_size', [10, 10])
        self.alert_thresholds = config.get('crowd_analysis.alert_thresholds', {
            'low': 20, 'medium': 50, 'high': 100
        })
        
        # History tracking
        self.count_history = deque(maxlen=100)  # Last 100 counts
        self.density_history = deque(maxlen=100)  # Last 100 density scores
        self.time_history = deque(maxlen=100)  # Timestamps
        
        # Smoothed values
        self.smoothed_count = 0.0
        self.smoothed_density = 0.0
        
        # Frame dimensions (will be set when first frame is processed)
        self.frame_width = None
        self.frame_height = None
        
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup logging for crowd analyzer"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def update_frame_dimensions(self, width: int, height: int):
        """
        Update frame dimensions for density calculations
        
        Args:
            width: Frame width
            height: Frame height
        """
        self.frame_width = width
        self.frame_height = height
    
    def analyze_crowd(self, detections: Dict, frame_shape: Tuple[int, int, int] = None) -> Dict:
        """
        Perform comprehensive crowd analysis
        
        Args:
            detections: Detection results from YOLOv8
            frame_shape: Shape of the frame (height, width, channels)
            
        Returns:
            Comprehensive crowd analysis results
        """
        if frame_shape:
            self.update_frame_dimensions(frame_shape[1], frame_shape[0])
        
        current_time = time.time()
        person_count = detections['person_count']
        boxes = detections['boxes']
        
        # Calculate density score
        density_score = self.calculate_density_score(boxes)
        
        # Update history
        self.count_history.append(person_count)
        self.density_history.append(density_score)
        self.time_history.append(current_time)
        
        # Apply temporal smoothing
        self._update_smoothed_values(person_count, density_score)
        
        # Generate density heatmap
        density_heatmap = self.generate_density_heatmap(boxes)
        
        # Analyze spatial distribution
        spatial_analysis = self.analyze_spatial_distribution(boxes)
        
        # Detect crowd level
        crowd_level = self.classify_crowd_level(self.smoothed_count)
        
        # Calculate trends
        trends = self.calculate_trends()
        
        # Detect anomalies
        anomalies = self.detect_anomalies(person_count, density_score)
        
        return {
            'person_count': person_count,
            'smoothed_count': self.smoothed_count,
            'density_score': density_score,
            'smoothed_density': self.smoothed_density,
            'crowd_level': crowd_level,
            'density_heatmap': density_heatmap,
            'spatial_analysis': spatial_analysis,
            'trends': trends,
            'anomalies': anomalies,
            'timestamp': current_time
        }
    
    def calculate_density_score(self, boxes: List[List[int]]) -> float:
        """
        Calculate crowd density score based on bounding boxes
        
        Args:
            boxes: List of bounding boxes [x1, y1, x2, y2]
            
        Returns:
            Density score between 0 and 1
        """
        if not boxes or not self.frame_width or not self.frame_height:
            return 0.0
        
        if self.density_method == 'bbox_coverage':
            return self._calculate_bbox_coverage_density(boxes)
        elif self.density_method == 'spatial_distribution':
            return self._calculate_spatial_distribution_density(boxes)
        else:
            return self._calculate_bbox_coverage_density(boxes)
    
    def _calculate_bbox_coverage_density(self, boxes: List[List[int]]) -> float:
        """Calculate density based on bounding box coverage area"""
        if not boxes:
            return 0.0
        
        total_area = self.frame_width * self.frame_height
        covered_area = 0
        
        # Create a mask to avoid double counting overlapping boxes
        mask = np.zeros((self.frame_height, self.frame_width), dtype=np.uint8)
        
        for box in boxes:
            x1, y1, x2, y2 = box
            # Ensure coordinates are within bounds
            x1 = max(0, min(x1, self.frame_width - 1))
            y1 = max(0, min(y1, self.frame_height - 1))
            x2 = max(0, min(x2, self.frame_width - 1))
            y2 = max(0, min(y2, self.frame_height - 1))
            
            if x2 > x1 and y2 > y1:
                mask[y1:y2, x1:x2] = 1
        
        covered_area = np.sum(mask)
        density = covered_area / total_area
        
        return min(density, 1.0)  # Cap at 1.0
    
    def _calculate_spatial_distribution_density(self, boxes: List[List[int]]) -> float:
        """Calculate density based on spatial distribution of person centers"""
        if len(boxes) < 2:
            return len(boxes) / 100.0  # Simple normalization for low counts
        
        # Get center points of all bounding boxes
        centers = []
        for box in boxes:
            x1, y1, x2, y2 = box
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            centers.append([center_x, center_y])
        
        centers = np.array(centers)
        
        # Calculate average distance between nearest neighbors
        distances = cdist(centers, centers)
        np.fill_diagonal(distances, np.inf)  # Ignore self-distances
        
        min_distances = np.min(distances, axis=1)
        avg_min_distance = np.mean(min_distances)
        
        # Normalize based on frame dimensions
        frame_diagonal = np.sqrt(self.frame_width**2 + self.frame_height**2)
        normalized_distance = avg_min_distance / frame_diagonal
        
        # Convert to density (inverse of distance)
        density = 1.0 - min(normalized_distance, 1.0)
        
        return density
    
    def generate_density_heatmap(self, boxes: List[List[int]]) -> np.ndarray:
        """
        Generate density heatmap based on person locations
        
        Args:
            boxes: List of bounding boxes
            
        Returns:
            Density heatmap as numpy array
        """
        if not self.frame_width or not self.frame_height:
            return np.zeros(self.grid_size)
        
        grid_h, grid_w = self.grid_size
        heatmap = np.zeros((grid_h, grid_w))
        
        if not boxes:
            return heatmap
        
        # Calculate grid cell dimensions
        cell_width = self.frame_width / grid_w
        cell_height = self.frame_height / grid_h
        
        # Count persons in each grid cell
        for box in boxes:
            x1, y1, x2, y2 = box
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            
            # Determine grid cell
            grid_x = int(center_x / cell_width)
            grid_y = int(center_y / cell_height)
            
            # Ensure within bounds
            grid_x = max(0, min(grid_x, grid_w - 1))
            grid_y = max(0, min(grid_y, grid_h - 1))
            
            heatmap[grid_y, grid_x] += 1
        
        # Normalize heatmap
        if np.max(heatmap) > 0:
            heatmap = heatmap / np.max(heatmap)
        
        return heatmap
    
    def analyze_spatial_distribution(self, boxes: List[List[int]]) -> Dict:
        """
        Analyze spatial distribution of crowd
        
        Args:
            boxes: List of bounding boxes
            
        Returns:
            Spatial analysis results
        """
        if not boxes:
            return {
                'center_of_mass': [0, 0],
                'spread': 0.0,
                'clustering_score': 0.0,
                'edge_density': 0.0
            }
        
        # Calculate center of mass
        centers = []
        for box in boxes:
            x1, y1, x2, y2 = box
            center_x = (x1 + x2) / 2
            center_y = (y1 + y2) / 2
            centers.append([center_x, center_y])
        
        centers = np.array(centers)
        center_of_mass = np.mean(centers, axis=0).tolist()
        
        # Calculate spread (standard deviation of positions)
        if len(centers) > 1:
            spread = np.mean(np.std(centers, axis=0))
        else:
            spread = 0.0
        
        # Calculate clustering score (inverse of average pairwise distance)
        clustering_score = self._calculate_clustering_score(centers)
        
        # Calculate edge density (percentage of people near frame edges)
        edge_density = self._calculate_edge_density(centers)
        
        return {
            'center_of_mass': center_of_mass,
            'spread': float(spread),
            'clustering_score': clustering_score,
            'edge_density': edge_density
        }
    
    def _calculate_clustering_score(self, centers: np.ndarray) -> float:
        """Calculate how clustered the crowd is"""
        if len(centers) < 2:
            return 0.0
        
        # Calculate pairwise distances
        distances = cdist(centers, centers)
        # Remove diagonal (self-distances)
        mask = np.eye(len(centers), dtype=bool)
        distances = distances[~mask]
        
        avg_distance = np.mean(distances)
        
        # Normalize by frame diagonal
        if self.frame_width and self.frame_height:
            frame_diagonal = np.sqrt(self.frame_width**2 + self.frame_height**2)
            normalized_distance = avg_distance / frame_diagonal
            clustering_score = 1.0 - min(normalized_distance, 1.0)
        else:
            clustering_score = 0.0
        
        return clustering_score
    
    def _calculate_edge_density(self, centers: np.ndarray) -> float:
        """Calculate percentage of people near frame edges"""
        if not centers.size or not self.frame_width or not self.frame_height:
            return 0.0
        
        edge_threshold = 0.1  # 10% of frame dimension
        edge_x = self.frame_width * edge_threshold
        edge_y = self.frame_height * edge_threshold
        
        near_edge_count = 0
        for center in centers:
            x, y = center
            if (x < edge_x or x > self.frame_width - edge_x or 
                y < edge_y or y > self.frame_height - edge_y):
                near_edge_count += 1
        
        return near_edge_count / len(centers)
    
    def classify_crowd_level(self, person_count: float) -> str:
        """
        Classify crowd level based on person count
        
        Args:
            person_count: Number of people (can be smoothed value)
            
        Returns:
            Crowd level: 'low', 'medium', 'high', or 'critical'
        """
        thresholds = self.alert_thresholds
        
        if person_count < thresholds['low']:
            return 'low'
        elif person_count < thresholds['medium']:
            return 'medium'
        elif person_count < thresholds['high']:
            return 'high'
        else:
            return 'critical'
    
    def calculate_trends(self) -> Dict:
        """Calculate trends in crowd metrics"""
        if len(self.count_history) < 10:
            return {
                'count_trend': 'stable',
                'count_rate': 0.0,
                'density_trend': 'stable',
                'density_rate': 0.0
            }
        
        # Calculate recent trends (last 10 measurements)
        recent_counts = list(self.count_history)[-10:]
        recent_densities = list(self.density_history)[-10:]
        recent_times = list(self.time_history)[-10:]
        
        # Calculate rates of change
        count_rate = self._calculate_rate_of_change(recent_counts, recent_times)
        density_rate = self._calculate_rate_of_change(recent_densities, recent_times)
        
        # Classify trends
        count_trend = self._classify_trend(count_rate)
        density_trend = self._classify_trend(density_rate)
        
        return {
            'count_trend': count_trend,
            'count_rate': count_rate,
            'density_trend': density_trend,
            'density_rate': density_rate
        }
    
    def _calculate_rate_of_change(self, values: List[float], times: List[float]) -> float:
        """Calculate rate of change using linear regression"""
        if len(values) < 2:
            return 0.0
        
        x = np.array(times) - times[0]  # Normalize time
        y = np.array(values)
        
        # Simple linear regression
        if len(x) > 1 and np.std(x) > 0:
            slope = np.corrcoef(x, y)[0, 1] * (np.std(y) / np.std(x))
            return slope
        
        return 0.0
    
    def _classify_trend(self, rate: float) -> str:
        """Classify trend based on rate of change"""
        if rate > 0.5:
            return 'increasing'
        elif rate < -0.5:
            return 'decreasing'
        else:
            return 'stable'
    
    def detect_anomalies(self, current_count: int, current_density: float) -> Dict:
        """
        Detect anomalies in crowd behavior
        
        Args:
            current_count: Current person count
            current_density: Current density score
            
        Returns:
            Anomaly detection results
        """
        anomalies = {
            'count_anomaly': False,
            'density_anomaly': False,
            'sudden_change': False
        }
        
        if len(self.count_history) < 20:
            return anomalies
        
        # Calculate statistics from recent history
        recent_counts = list(self.count_history)[-20:]
        recent_densities = list(self.density_history)[-20:]
        
        count_mean = np.mean(recent_counts)
        count_std = np.std(recent_counts)
        density_mean = np.mean(recent_densities)
        density_std = np.std(recent_densities)
        
        # Detect count anomalies (outside 2 standard deviations)
        if count_std > 0:
            count_z_score = abs(current_count - count_mean) / count_std
            if count_z_score > 2:
                anomalies['count_anomaly'] = True
        
        # Detect density anomalies
        if density_std > 0:
            density_z_score = abs(current_density - density_mean) / density_std
            if density_z_score > 2:
                anomalies['density_anomaly'] = True
        
        # Detect sudden changes (large difference from previous measurement)
        if len(self.count_history) > 1:
            prev_count = self.count_history[-2]
            count_change = abs(current_count - prev_count)
            if count_change > max(10, count_mean * 0.3):  # 30% change or 10 people
                anomalies['sudden_change'] = True
        
        return anomalies
    
    def _update_smoothed_values(self, current_count: int, current_density: float):
        """Update smoothed values using exponential moving average"""
        if self.smoothed_count == 0:
            # Initialize with first value
            self.smoothed_count = float(current_count)
            self.smoothed_density = current_density
        else:
            # Apply exponential smoothing
            alpha = self.smoothing_factor
            self.smoothed_count = alpha * current_count + (1 - alpha) * self.smoothed_count
            self.smoothed_density = alpha * current_density + (1 - alpha) * self.smoothed_density
    
    def visualize_density_heatmap(self, heatmap: np.ndarray, target_size: Tuple[int, int] = None) -> np.ndarray:
        """
        Convert density heatmap to visualizable format
        
        Args:
            heatmap: Density heatmap
            target_size: Target size for visualization (width, height)
            
        Returns:
            Colored heatmap for visualization
        """
        # Resize heatmap if target size provided
        if target_size:
            heatmap = cv2.resize(heatmap, target_size, interpolation=cv2.INTER_LINEAR)
        
        # Convert to 8-bit
        heatmap_8bit = (heatmap * 255).astype(np.uint8)
        
        # Apply colormap
        colored_heatmap = cv2.applyColorMap(heatmap_8bit, cv2.COLORMAP_JET)
        
        return colored_heatmap
    
    def get_statistics(self) -> Dict:
        """Get comprehensive statistics"""
        if not self.count_history:
            return {}
        
        counts = list(self.count_history)
        densities = list(self.density_history)
        
        return {
            'current_count': counts[-1] if counts else 0,
            'smoothed_count': self.smoothed_count,
            'avg_count': np.mean(counts),
            'max_count': np.max(counts),
            'min_count': np.min(counts),
            'current_density': densities[-1] if densities else 0,
            'smoothed_density': self.smoothed_density,
            'avg_density': np.mean(densities),
            'max_density': np.max(densities),
            'min_density': np.min(densities),
            'history_length': len(counts)
        }


def test_crowd_analyzer():
    """Test function for crowd analyzer"""
    print("Testing Crowd Analyzer...")
    
    try:
        analyzer = CrowdAnalyzer()
        
        # Create test detections
        test_detections = {
            'boxes': [[100, 100, 150, 200], [200, 150, 250, 250], [300, 100, 350, 200]],
            'scores': [0.9, 0.8, 0.85],
            'person_count': 3
        }
        
        # Test analysis
        results = analyzer.analyze_crowd(test_detections, (480, 640, 3))
        print(f"Analysis results: {results}")
        
        # Test multiple frames
        for i in range(5):
            test_detections['person_count'] = 3 + i
            results = analyzer.analyze_crowd(test_detections, (480, 640, 3))
            print(f"Frame {i+1} - Count: {results['person_count']}, Density: {results['density_score']:.3f}")
        
        stats = analyzer.get_statistics()
        print(f"Statistics: {stats}")
        
        print("Crowd Analyzer test completed successfully!")
        
    except Exception as e:
        print(f"Error testing crowd analyzer: {e}")


if __name__ == "__main__":
    test_crowd_analyzer()