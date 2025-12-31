import cv2
import numpy as np
import os
import sys

# Add parent to path
sys.path.append(os.path.join(os.path.dirname(__file__)))

from geometry import StructuralGapCloser

def test_gap_closer():
    # Create a dummy mask with two lines and a gap
    mask = np.zeros((400, 400), dtype=np.uint8)
    cv2.line(mask, (50, 200), (150, 200), 255, 5) # Left segment
    cv2.line(mask, (250, 200), (350, 200), 255, 5) # Right segment
    
    # Gap is from 150 to 250 (100px)
    
    closer = StructuralGapCloser(ppm=100)
    closed = closer.close_gaps(mask, max_gap_px=150)
    
    # Check if the gap is closed (point 200, 200 should be white)
    is_closed = closed[200, 200] == 255
    print(f"Gap Closed: {is_closed}")
    
    if is_closed:
        print("Success: StructuralGapCloser bridged the gap.")
    else:
        print("Failure: StructuralGapCloser did not bridge the gap.")

if __name__ == "__main__":
    test_gap_closer()
