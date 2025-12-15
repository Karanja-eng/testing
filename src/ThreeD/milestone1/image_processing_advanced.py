# backend/utils/image_processing_advanced.py
"""
Advanced image processing utilities for architectural floor plan analysis
"""
import cv2
import numpy as np
from typing import List, Tuple, Dict
from dataclasses import dataclass

@dataclass
class DetectedElement:
    """Represents a detected architectural element"""
    type: str
    position: Tuple[float, float]
    dimensions: Tuple[float, float]
    rotation: float
    confidence: float


class AdvancedFloorPlanAnalyzer:
    """Advanced analysis tools for architectural floor plans"""
    
    def __init__(self, pixels_per_meter: float = 100):
        self.ppm = pixels_per_meter
        
    def detect_parallel_walls(self, binary_image: np.ndarray) -> List[Tuple[np.ndarray, np.ndarray]]:
        """Detect parallel wall pairs to determine wall thickness"""
        edges = cv2.Canny(binary_image, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=50, maxLineGap=10)
        
        if lines is None:
            return []
        
        wall_pairs = []
        lines = lines.reshape(-1, 4)
        
        for i, line1 in enumerate(lines):
            x1, y1, x2, y2 = line1
            angle1 = np.arctan2(y2 - y1, x2 - x1)
            
            for line2 in lines[i+1:]:
                x3, y3, x4, y4 = line2
                angle2 = np.arctan2(y4 - y3, x4 - x3)
                
                # Check if parallel (similar angles)
                angle_diff = abs(angle1 - angle2) * 180 / np.pi
                if angle_diff < 5 or angle_diff > 175:
                    # Calculate perpendicular distance
                    dist = self._perpendicular_distance(line1, line2)
                    
                    # Typical wall thickness: 150-400mm
                    if 0.1 < dist < 0.5:
                        wall_pairs.append((line1, line2))
        
        return wall_pairs
    
    def _perpendicular_distance(self, line1: np.ndarray, line2: np.ndarray) -> float:
        """Calculate perpendicular distance between parallel lines"""
        x1, y1, x2, y2 = line1
        x3, y3, x4, y4 = line2
        
        # Line1 direction
        dx = x2 - x1
        dy = y2 - y1
        length = np.sqrt(dx**2 + dy**2)
        
        if length == 0:
            return 0
        
        # Normalize
        dx /= length
        dy /= length
        
        # Perpendicular from line2 start to line1
        dot = (x3 - x1) * dx + (y3 - y1) * dy
        closest_x = x1 + dot * dx
        closest_y = y1 + dot * dy
        
        dist_pixels = np.sqrt((x3 - closest_x)**2 + (y3 - closest_y)**2)
        return dist_pixels / self.ppm
    
    def identify_room_type(self, contour: np.ndarray, area_m2: float, 
                          aspect_ratio: float) -> str:
        """Identify room type based on geometric features"""
        # Area-based classification
        if area_m2 < 3:
            return "bathroom"
        elif area_m2 < 6:
            if aspect_ratio > 2:
                return "corridor"
            return "bathroom"
        elif area_m2 < 12:
            return "bedroom"
        elif area_m2 < 20:
            if aspect_ratio < 1.5:
                return "kitchen"
            return "dining"
        else:
            return "living"
    
    def detect_door_swing(self, binary_image: np.ndarray, 
                         door_position: Tuple[int, int]) -> float:
        """Detect door swing arc to determine opening direction"""
        x, y = door_position
        roi_size = 50
        roi = binary_image[
            max(0, y-roi_size):y+roi_size,
            max(0, x-roi_size):x+roi_size
        ]
        
        # Look for arc patterns
        circles = cv2.HoughCircles(
            roi, cv2.HOUGH_GRADIENT, 1, 20,
            param1=50, param2=30, minRadius=10, maxRadius=40
        )
        
        if circles is not None:
            # Door swing detected
            return circles[0][0][2] / self.ppm  # Return radius in meters
        
        return 0.9  # Default door width
    
    def extract_text_annotations(self, image: np.ndarray) -> Dict[str, List[Tuple[str, Tuple[int, int]]]]:
        """Extract text labels from floor plan"""
        import pytesseract
        from pytesseract import Output
        
        # Get text with bounding boxes
        data = pytesseract.image_to_data(image, output_type=Output.DICT)
        
        annotations = {
            'dimensions': [],
            'room_labels': [],
            'notes': []
        }
        
        for i, text in enumerate(data['text']):
            if text.strip():
                x, y = data['left'][i], data['top'][i]
                
                # Classify text type
                if any(char.isdigit() for char in text) and ('m' in text.lower() or 'mm' in text.lower()):
                    annotations['dimensions'].append((text, (x, y)))
                elif len(text) > 3 and text[0].isupper():
                    annotations['room_labels'].append((text, (x, y)))
                else:
                    annotations['notes'].append((text, (x, y)))
        
        return annotations
    
    def calculate_wall_intersections(self, walls: List) -> List[Tuple[float, float]]:
        """Find wall intersection points (corners)"""
        intersections = []
        
        for i, wall1 in enumerate(walls):
            for wall2 in walls[i+1:]:
                intersection = self._line_intersection(
                    wall1.start, wall1.end,
                    wall2.start, wall2.end
                )
                if intersection:
                    intersections.append(intersection)
        
        return intersections
    
    def _line_intersection(self, p1, p2, p3, p4) -> Tuple[float, float]:
        """Calculate intersection point of two line segments"""
        x1, y1 = p1
        x2, y2 = p2
        x3, y3 = p3
        x4, y4 = p4
        
        denom = (x1-x2)*(y3-y4) - (y1-y2)*(x3-x4)
        if abs(denom) < 1e-10:
            return None
        
        t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / denom
        u = -((x1-x2)*(y1-y3) - (y1-y2)*(x1-x3)) / denom
        
        if 0 <= t <= 1 and 0 <= u <= 1:
            x = x1 + t*(x2-x1)
            y = y1 + t*(y2-y1)
            return (x, y)
        
        return None
    
    def enhance_floor_plan(self, image: np.ndarray) -> np.ndarray:
        """Enhance floor plan image for better detection"""
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        
        # Enhance contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(denoised)
        
        # Sharpen
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        sharpened = cv2.filter2D(enhanced, -1, kernel)
        
        return sharpened
    
    def detect_columns(self, binary_image: np.ndarray) -> List[Tuple[float, float, float]]:
        """Detect structural columns in floor plan"""
        # Look for small rectangular/circular filled regions
        contours, _ = cv2.findContours(binary_image, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        columns = []
        for contour in contours:
            area = cv2.contourArea(contour)
            
            # Column typical size: 200-600mm (0.2-0.6m)
            area_m2 = area / (self.ppm ** 2)
            if 0.04 < area_m2 < 0.36:  # 0.2m x 0.2m to 0.6m x 0.6m
                M = cv2.moments(contour)
                if M['m00'] != 0:
                    cx = M['m10'] / M['m00'] / self.ppm
                    cy = M['m01'] / M['m00'] / self.ppm
                    
                    # Estimate column size
                    x, y, w, h = cv2.boundingRect(contour)
                    size = max(w, h) / self.ppm
                    
                    columns.append((cx, cy, size))
        
        return columns
    
    def create_floor_topology(self, walls: List, doors: List, windows: List) -> Dict:
        """Create topological representation of floor plan"""
        topology = {
            'nodes': [],  # Wall intersections (corners)
            'edges': [],  # Wall segments
            'openings': []  # Doors and windows
        }
        
        # Extract nodes from walls
        nodes = set()
        for wall in walls:
            nodes.add(tuple(wall.start))
            nodes.add(tuple(wall.end))
        
        topology['nodes'] = [{'id': i, 'position': node} for i, node in enumerate(nodes)]
        
        # Create edges
        for wall in walls:
            start_id = next(i for i, n in enumerate(topology['nodes']) 
                          if n['position'] == tuple(wall.start))
            end_id = next(i for i, n in enumerate(topology['nodes']) 
                        if n['position'] == tuple(wall.end))
            
            topology['edges'].append({
                'start': start_id,
                'end': end_id,
                'length': wall.length,
                'thickness': wall.thickness
            })
        
        # Add openings
        for door in doors:
            topology['openings'].append({
                'type': 'door',
                'position': door.position,
                'width': door.width,
                'height': door.height
            })
        
        for window in windows:
            topology['openings'].append({
                'type': 'window',
                'position': window.position,
                'width': window.width,
                'height': window.height
            })
        
        return topology


class ScaleDetector:
    """Automatically detect scale from floor plan"""
    
    def __init__(self):
        self.known_dimensions = {
            'door_width': (0.8, 1.0),  # meters
            'window_width': (0.8, 2.0),
            'wall_thickness': (0.15, 0.4),
            'room_size': (2.5, 8.0)
        }
    
    def auto_detect_scale(self, image: np.ndarray, detected_elements: Dict) -> float:
        """Automatically detect scale factor"""
        # Try to find doors (most reliable reference)
        if 'doors' in detected_elements and detected_elements['doors']:
            door_widths_pixels = [d['width_pixels'] for d in detected_elements['doors']]
            avg_door_width_pixels = np.mean(door_widths_pixels)
            
            # Assume average door width is 0.9m
            pixels_per_meter = avg_door_width_pixels / 0.9
            return pixels_per_meter
        
        # Fallback: use wall lengths
        if 'walls' in detected_elements and detected_elements['walls']:
            wall_lengths_pixels = [w['length_pixels'] for w in detected_elements['walls']]
            median_wall_length = np.median(wall_lengths_pixels)
            
            # Assume median wall is about 4 meters
            pixels_per_meter = median_wall_length / 4.0
            return pixels_per_meter
        
        # Default scale
        return 100.0  # 100 pixels per meter


# Specialized processors for different plan types
class ResidentialPlanProcessor:
    """Specialized processor for residential floor plans"""
    
    def process(self, image: np.ndarray) -> Dict:
        """Process residential floor plan with specific heuristics"""
        # Residential-specific room identification
        # Typical residential features: bedrooms, bathrooms, kitchen, living room
        pass


class CommercialPlanProcessor:
    """Specialized processor for commercial floor plans"""
    
    def process(self, image: np.ndarray) -> Dict:
        """Process commercial floor plan"""
        # Commercial-specific features: open spaces, cubicles, meeting rooms
        pass


# Export functions
def export_to_obj(building_data: Dict, filename: str):
    """Export 3D model to OBJ format"""
    with open(filename, 'w') as f:
        f.write("# ArchCAD Pro 3D Export\n")
        f.write("# Vertices\n")
        
        vertex_id = 1
        for floor in building_data['floors']:
            floor_level = floor['level'] * building_data['wallHeight']
            
            for wall in floor['walls']:
                # Write wall vertices
                # ... (implement full OBJ export)
                pass
        
        f.write("\n# Faces\n")
        # ... (implement faces)


def export_to_json(building_data: Dict, filename: str):
    """Export building data to JSON"""
    import json
    with open(filename, 'w') as f:
        json.dump(building_data, f, indent=2)