import cv2
import numpy as np
from typing import List, Dict, Tuple

def extract_wall_lines(mask: np.ndarray, ppm: float, scale_x: float, scale_y: float) -> List[Dict]:
    """
    Extracts crisp wall segments from a binary mask using skeletonization and Hough Transform.
    Returns list of dicts with 'start', 'end', and 'thickness'.
    """
    if mask is None or np.sum(mask) == 0:
        return []

    # 1. Skeletonization to find centerlines
    skeleton = cv2.ximgproc.thinning(mask) if hasattr(cv2.ximgproc, 'thinning') else mask
    
    # 2. Hough Line Transform for straight segments
    # theta=1 degree, threshold=20, minLineLength=30, maxLineGap=10
    lines = cv2.HoughLinesP(skeleton, 1, np.pi/180, 20, minLineLength=30, maxLineGap=10)
    
    wall_segments = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            
            # Map pixels to world coordinates
            start = [float(x1) * scale_x, float(y1) * scale_y]
            end = [float(x2) * scale_x, float(y2) * scale_y]
            
            # Estimate thickness from mask
            # Sample midpoint
            mx, my = int((x1 + x2) / 2), int((y1 + y2) / 2)
            thickness_px = 0
            if 0 <= my < mask.shape[0] and 0 <= mx < mask.shape[1]:
                # Simple scan perpendicular to line or just fixed for now?
                # For baseline, let's use 0.15m or detect it.
                thickness_px = 15 # default px
            
            thickness_m = (thickness_px * (scale_x + scale_y) / 2) # simplified
            if thickness_m < 0.1: thickness_m = 0.15 # Minimum architectural wall
            
            wall_segments.append({
                "start": start,
                "end": end,
                "thickness": thickness_m,
                "length": np.sqrt((start[0]-end[0])**2 + (start[1]-end[1])**2)
            })
            
    return wall_segments

def clean_noisy_mask(mask: np.ndarray) -> np.ndarray:
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask
