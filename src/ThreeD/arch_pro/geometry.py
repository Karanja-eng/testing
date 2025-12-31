import cv2
import numpy as np
from typing import List, Tuple
from models import Wall

class GeometryProcessor:
    def __init__(self, ppm: float = 100):
        self.ppm = ppm

    def wall_filter(self, img: np.ndarray) -> np.ndarray:
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img.copy()
            
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = np.ones((3, 3), np.uint8)
        opening = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=2)
        dist_transform = cv2.distanceTransform(opening, cv2.DIST_L2, 5)
        _, sure_fg = cv2.threshold(dist_transform, 0.2 * dist_transform.max(), 255, 0)
        return np.uint8(sure_fg)

    def detect_walls(self, img: np.ndarray) -> List[Wall]:
        walls_img = self.wall_filter(img)
        contours, _ = cv2.findContours(walls_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        walls = []
        for i, cnt in enumerate(contours):
            epsilon = 0.01 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            
            for j in range(len(approx)):
                p1 = approx[j][0]
                p2 = approx[(j + 1) % len(approx)][0]
                
                x1, y1 = float(p1[0]) / self.ppm, float(p1[1]) / self.ppm
                x2, y2 = float(p2[0]) / self.ppm, float(p2[1]) / self.ppm
                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                
                if length > 0.3:
                    walls.append(Wall(
                        id=f"wall_{i}_{j}",
                        start=[round(x1, 2), round(y1, 2)],
                        end=[round(x2, 2), round(y2, 2)],
                        thickness=0.15,
                        length=round(length, 2)
                    ))
        return walls

    def extract_precise_room_polygons(self, img: np.ndarray) -> List[List[List[float]]]:
        # Advanced room extraction based on the user's snippet logic
        gray = self.wall_filter(img)
        inverted = cv2.bitwise_not(gray)
        
        # Closing gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(inverted, cv2.MORPH_CLOSE, kernel)
        
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polygons = []
        
        for cnt in contours:
            if cv2.contourArea(cnt) < 2000: continue
            epsilon = 0.01 * cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, epsilon, True)
            poly = [[float(p[0][0]) / self.ppm, float(p[0][1]) / self.ppm] for p in approx]
            polygons.append(poly)
            
        return polygons

class StructuralGapCloser:
    def __init__(self, ppm: float = 100):
        self.ppm = ppm

    def close_gaps(self, wall_mask: np.ndarray, max_gap_px: float = 200) -> np.ndarray:
        """
        Arch Pro 5.0 algorithm: Detects wall terminations using Harris Corners
        and bridges collinear gaps to ensure room-polygon stability.
        """
        # Ensure mask is 8-bit
        mask = wall_mask.copy()
        if mask.dtype != np.uint8: mask = mask.astype(np.uint8)

        # 1. Corner Harris
        dst = cv2.cornerHarris(mask, 2, 3, 0.04)
        dst = cv2.dilate(dst, None)
        
        # Threshold for robust corners
        corners = np.argwhere(dst > 0.01 * dst.max())
        if len(corners) == 0: return mask

        # 2. Bridge collinear corners (Horizontal and Vertical search)
        # Sort corners for efficient scanning
        # Note: In a dense floorplan, we look for corner points that "point" towards each other
        # For simplicity in this v5.0 milestone, we bridge corners on same X or Y within a window
        
        h, w = mask.shape[:2]
        
        # Horizontal Bridges
        corners_y = corners[corners[:, 0].argsort()]
        for i in range(len(corners_y) - 1):
            y1, x1 = corners_y[i]
            y2, x2 = corners_y[i+1]
            if abs(y1 - y2) < 3 and abs(x1 - x2) < max_gap_px:
                # Check if it crosses "mostly empty" space (to bridge gaps)
                # Drawing a small stabilizing line
                cv2.line(mask, (x1, y1), (x2, y2), 255, 2)

        # Vertical Bridges
        corners_x = corners[corners[:, 1].argsort()]
        for i in range(len(corners_x) - 1):
            y1, x1 = corners_x[i]
            y2, x2 = corners_x[i+1]
            if abs(x1 - x2) < 3 and abs(y1 - y2) < max_gap_px:
                cv2.line(mask, (mask_x := x1, y1), (mask_x, y2), 255, 2)

        return mask
