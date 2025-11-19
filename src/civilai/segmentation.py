# backend/segmentation.py (ROBUST VERSION)
"""
CAD-Quality Pipeline with extensive debugging and fallback strategies
"""
import os
import numpy as np
import torch
import torch.nn.functional as F
import cv2
from pathlib import Path
from shapely.geometry import LineString, Point, Polygon, MultiPolygon, box
from shapely.ops import unary_union
from scipy import ndimage
from skimage.morphology import skeletonize
from skimage.measure import label, regionprops
import trimesh
from ultralytics import YOLO


# ============================================================================
# CONFIGURATION
# ============================================================================
BASE_DIR = Path(__file__).parent
CHECKPOINT = BASE_DIR / "model" / "model_best_val_loss_var.pkl"
YOLO_WEIGHTS = BASE_DIR / "best.pt"
MODEL_NAME = "hg_furukawa_original"
N_CLASSES = 44
SPLIT = [21, 12, 11]
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

DEFAULT_WALL_THICKNESS = 0.15
MIN_WALL_LENGTH = 0.5


# ============================================================================
# MODEL LOADING
# ============================================================================
from model import get_model
from utils.loaders import RotateNTurns

rot = RotateNTurns()
model = get_model(MODEL_NAME, 51)
model.conv4_ = torch.nn.Conv2d(256, N_CLASSES, bias=True, kernel_size=1)
model.upsample = torch.nn.ConvTranspose2d(N_CLASSES, N_CLASSES, kernel_size=4, stride=4)

checkpoint = torch.load(CHECKPOINT, map_location=DEVICE)
model.load_state_dict(checkpoint["model_state"])
model.to(DEVICE)
model.eval()

try:
    yolo = YOLO(str(YOLO_WEIGHTS)) if YOLO_WEIGHTS.exists() else None
    if yolo:
        yolo.to(DEVICE)
except:
    yolo = None

print(f"✓ Models loaded on {DEVICE}")


# ============================================================================
# STEP 1: NEURAL NETWORK PREDICTION
# ============================================================================
def run_furukawa_model(img_tensor, height, width):
    """Run Furukawa model with rotation augmentation"""
    rotations = [(0, 0), (1, -1), (2, 2), (-1, 1)]
    pred_stack = torch.zeros([len(rotations), N_CLASSES, height, width], device=DEVICE)
    
    with torch.no_grad():
        for i, (forward, back) in enumerate(rotations):
            rot_img = rot(img_tensor, "tensor", forward)
            pred = model(rot_img)
            pred = rot(pred, "tensor", back)
            pred = rot(pred, "points", back)
            pred = F.interpolate(pred, size=(height, width), mode="bilinear", align_corners=True)
            pred_stack[i] = pred[0]
        
        prediction = torch.mean(pred_stack, dim=0, keepdim=True).cpu()
    
    return prediction.squeeze(0)


# ============================================================================
# FALLBACK: SIMPLE POLYGON EXTRACTION
# ============================================================================
def extract_simple_wall_polygons(wall_mask, min_area=500, scale=0.01):
    """
    Fallback method: Direct polygon extraction from mask
    Used when skeletonization fails
    """
    print("  Using fallback: Direct polygon extraction")
    
    # Clean mask
    kernel = np.ones((5, 5), np.uint8)
    cleaned = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel, iterations=3)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # Find contours
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    polygons = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        
        # Simplify
        epsilon = 0.01 * cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        
        if len(approx) >= 3:
            pts = approx.squeeze()
            if pts.ndim == 1:
                pts = pts.reshape(-1, 2)
            
            try:
                poly = Polygon(pts)
                if poly.is_valid and poly.area > min_area:
                    polygons.append(poly)
            except:
                pass
    
    print(f"  Fallback extracted {len(polygons)} polygons")
    return polygons


# ============================================================================
# STEP 2: CREATE WALL POLYGONS
# ============================================================================
def create_wall_polygons_from_mask(wall_mask, threshold=0.3, scale=0.01, wall_thickness=0.15):
    """
    Multiple strategies to extract walls
    """
    print("\n--- Wall Extraction ---")
    print(f"Mask shape: {wall_mask.shape}, Coverage: {wall_mask.sum() / wall_mask.size * 100:.1f}%")
    
    if wall_mask.sum() == 0:
        print("ERROR: Wall mask is completely empty!")
        return []
    
    # Save debug image
    debug_dir = Path("debug_output")
    debug_dir.mkdir(exist_ok=True)
    cv2.imwrite(str(debug_dir / "01_wall_mask.png"), wall_mask * 255)
    print(f"  Saved debug mask to {debug_dir}/01_wall_mask.png")
    
    # Strategy 1: Try skeletonization
    try:
        print("\nStrategy 1: Skeletonization + Vectorization")
        skeleton = skeletonize(wall_mask > 0)
        cv2.imwrite(str(debug_dir / "02_skeleton.png"), skeleton.astype(np.uint8) * 255)
        print(f"  Skeleton pixels: {skeleton.sum()}")
        
        if skeleton.sum() > 10:
            # Extract line segments from skeleton
            contours, _ = cv2.findContours(skeleton.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
            
            lines = []
            for cnt in contours:
                if len(cnt) >= 2:
                    epsilon = 3.0
                    approx = cv2.approxPolyDP(cnt, epsilon, False)
                    
                    if len(approx) >= 2:
                        pts = approx.squeeze()
                        if pts.ndim == 1:
                            pts = pts.reshape(-1, 2)
                        
                        for i in range(len(pts) - 1):
                            p1, p2 = pts[i], pts[i + 1]
                            if tuple(p1) != tuple(p2):
                                lines.append(LineString([p1, p2]))
            
            print(f"  Extracted {len(lines)} line segments")
            
            if lines:
                # Create wall polygons from centerlines
                wall_polygons = []
                thickness_pixels = wall_thickness / scale / 2
                
                for line in lines:
                    if line.length * scale >= MIN_WALL_LENGTH:
                        wall_poly = line.buffer(thickness_pixels, cap_style=2)
                        if wall_poly.is_valid and wall_poly.area > 100:
                            wall_polygons.append(wall_poly)
                
                print(f"  Created {len(wall_polygons)} wall polygons")
                
                if wall_polygons:
                    # Merge overlapping walls
                    merged = unary_union(wall_polygons)
                    if isinstance(merged, Polygon):
                        final = [merged]
                    elif isinstance(merged, MultiPolygon):
                        final = [p for p in merged.geoms if p.area > 100]
                    else:
                        final = wall_polygons
                    
                    print(f"  After merging: {len(final)} walls")
                    
                    if final:
                        return final
    
    except Exception as e:
        print(f"  Skeletonization failed: {e}")
    
    # Strategy 2: Direct contour extraction
    print("\nStrategy 2: Direct Contour Extraction")
    try:
        polygons = extract_simple_wall_polygons(wall_mask, min_area=500, scale=scale)
        if polygons:
            return polygons
    except Exception as e:
        print(f"  Direct extraction failed: {e}")
    
    # Strategy 3: Dilate then extract outer boundary
    print("\nStrategy 3: Outer Boundary Extraction")
    try:
        kernel = np.ones((15, 15), np.uint8)
        dilated = cv2.dilate(wall_mask, kernel, iterations=2)
        cv2.imwrite(str(debug_dir / "03_dilated.png"), dilated * 255)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if contours:
            # Take the largest contour
            largest = max(contours, key=cv2.contourArea)
            epsilon = 0.005 * cv2.arcLength(largest, True)
            approx = cv2.approxPolyDP(largest, epsilon, True)
            
            pts = approx.squeeze()
            if pts.ndim == 1:
                pts = pts.reshape(-1, 2)
            
            poly = Polygon(pts)
            if poly.is_valid and poly.area > 1000:
                print(f"  Extracted outer boundary: {len(pts)} vertices")
                return [poly]
    
    except Exception as e:
        print(f"  Boundary extraction failed: {e}")
    
    print("\nERROR: All extraction strategies failed!")
    return []


# ============================================================================
# STEP 3: DETECT OPENINGS
# ============================================================================
def extract_openings(opening_mask, min_area=100, max_count=50):
    """Extract door/window bounding boxes"""
    if opening_mask.sum() == 0:
        return []
    
    openings = []
    labeled = label(opening_mask)
    regions = regionprops(labeled)
    
    for region in regions[:max_count]:
        if region.area < min_area:
            continue
        
        minr, minc, maxr, maxc = region.bbox
        opening_box = box(minc, minr, maxc, maxr)
        openings.append(opening_box)
    
    return openings


# ============================================================================
# STEP 4: GENERATE 3D MESH
# ============================================================================
def create_3d_mesh_simple(wall_polygons, scale=0.01, wall_height=3.0):
    """
    Simplified 3D mesh generation with better error handling
    """
    print(f"\n--- Creating 3D Mesh ---")
    print(f"Input: {len(wall_polygons)} wall polygons")
    
    if not wall_polygons:
        raise ValueError("No wall polygons to convert to 3D!")
    
    scene = trimesh.Scene()
    created_count = 0
    
    for i, wall_poly in enumerate(wall_polygons):
        try:
            # Get exterior coordinates
            if hasattr(wall_poly, 'exterior'):
                coords = np.array(wall_poly.exterior.coords)
            else:
                continue
            
            # Scale to meters
            coords = coords * scale
            
            # Remove duplicate last point if present
            if np.allclose(coords[0], coords[-1]):
                coords = coords[:-1]
            
            if len(coords) < 3:
                continue
            
            # Create 3D vertices
            n = len(coords)
            vertices = np.zeros((n * 2, 3))
            
            # Bottom vertices (z=0)
            vertices[:n, :2] = coords
            vertices[:n, 2] = 0
            
            # Top vertices (z=wall_height)
            vertices[n:, :2] = coords
            vertices[n:, 2] = wall_height
            
            # Create faces
            faces = []
            
            # Bottom face (reversed for correct normal)
            faces.append(list(range(n-1, -1, -1)))
            
            # Top face
            faces.append(list(range(n, 2*n)))
            
            # Side faces (two triangles per edge)
            for j in range(n):
                next_j = (j + 1) % n
                # Triangle 1
                faces.append([j, next_j, n + next_j])
                # Triangle 2
                faces.append([j, n + next_j, n + j])
            
            # Create mesh
            try:
                mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
                mesh.fix_normals()
                
                # Add color
                mesh.visual.vertex_colors = [200, 200, 200, 255]
                
                scene.add_geometry(mesh, node_name=f"wall_{i}")
                created_count += 1
                
            except Exception as e:
                print(f"  Warning: Failed to create mesh for wall {i}: {e}")
                continue
        
        except Exception as e:
            print(f"  Warning: Failed to process wall {i}: {e}")
            continue
    
    print(f"  Successfully created {created_count}/{len(wall_polygons)} wall meshes")
    
    if created_count == 0:
        raise ValueError("Failed to create any 3D meshes!")
    
    return scene


# ============================================================================
# MAIN PIPELINE
# ============================================================================
def process_floorplan(img_path, 
                     wall_threshold=0.3,
                     opening_threshold=0.5,
                     wall_thickness=DEFAULT_WALL_THICKNESS,
                     scale=0.01,
                     wall_height=3.0,
                     use_yolo=False,
                     output_glb=None):
    """
    Complete CAD-quality pipeline with robust error handling
    """
    print(f"\n{'='*70}")
    print(f"CAD-QUALITY PIPELINE")
    print(f"Processing: {img_path}")
    print(f"Parameters: wall_th={wall_thickness}m, height={wall_height}m, scale={scale}")
    print(f"{'='*70}\n")
    
    # Load image
    img = cv2.imread(str(img_path))
    if img is None:
        raise ValueError(f"Failed to load image: {img_path}")
    
    h, w = img.shape[:2]
    print(f"Step 1: Image loaded ({w}x{h})")
    
    # Prepare input
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img_input = 2 * (img_rgb.astype(np.float32) / 255.0) - 1
    img_input = np.moveaxis(img_input, -1, 0)
    img_tensor = torch.from_numpy(img_input).unsqueeze(0).float().to(DEVICE)
    
    # Run neural network
    print("\nStep 2: Running Furukawa model...")
    size_check = np.array([h, w]) % 2
    height = h - size_check[0]
    width = w - size_check[1]
    
    prediction = run_furukawa_model(img_tensor, height, width)
    print(f"  ✓ Prediction shape: {prediction.shape}")
    
    # Split prediction
    heatmaps = prediction[:SPLIT[0]]
    rooms = prediction[SPLIT[0]:SPLIT[0]+SPLIT[1]]
    icons = prediction[SPLIT[0]+SPLIT[1]:]
    
    print(f"  Heatmaps: {heatmaps.shape}, Rooms: {rooms.shape}, Icons: {icons.shape}")
    
    # Create wall mask from rooms (primary method)
    print("\nStep 3: Creating wall mask...")
    room_combined = rooms.sum(dim=0).numpy()
    wall_mask = (room_combined > wall_threshold).astype(np.uint8)
    
    print(f"  Wall mask coverage: {wall_mask.sum() / wall_mask.size * 100:.1f}%")
    
    # If wall mask is too sparse, try heatmaps
    if wall_mask.sum() < 1000:
        print("  Wall mask too sparse, trying heatmaps...")
        heatmap_combined = heatmaps[:5].max(dim=0)[0].numpy()
        wall_mask = (heatmap_combined > wall_threshold * 0.7).astype(np.uint8)
        print(f"  Heatmap mask coverage: {wall_mask.sum() / wall_mask.size * 100:.1f}%")
    
    if wall_mask.sum() < 100:
        raise ValueError(f"Wall mask is nearly empty! Coverage: {wall_mask.sum()} pixels. "
                        f"Try lowering wall_threshold to {wall_threshold * 0.5:.2f}")
    
    # Extract wall polygons
    print("\nStep 4: Extracting wall polygons...")
    wall_polygons = create_wall_polygons_from_mask(
        wall_mask, 
        threshold=wall_threshold,
        scale=scale,
        wall_thickness=wall_thickness
    )
    
    if not wall_polygons:
        raise ValueError("No wall polygons extracted! Check debug_output/ folder for masks.")
    
    print(f"  ✓ Extracted {len(wall_polygons)} wall polygons")
    
    # Detect openings (optional)
    doors = []
    windows = []
    
    try:
        print("\nStep 5: Detecting openings...")
        
        # Try to get door/window from heatmaps
        if heatmaps.shape[0] > 1:
            door_mask = (heatmaps[1].numpy() > opening_threshold).astype(np.uint8)
            doors = extract_openings(door_mask, min_area=50)
            print(f"  Found {len(doors)} doors")
        
        if heatmaps.shape[0] > 2:
            window_mask = (heatmaps[2].numpy() > opening_threshold).astype(np.uint8)
            windows = extract_openings(window_mask, min_area=30)
            print(f"  Found {len(windows)} windows")
    
    except Exception as e:
        print(f"  Opening detection failed: {e}")
    
    # Cut openings from walls (if any found)
    if doors or windows:
        print("\nStep 6: Cutting openings from walls...")
        final_walls = []
        for wall in wall_polygons:
            current = wall
            for door in doors:
                if current.intersects(door):
                    current = current.difference(door.buffer(1))
            for window in windows:
                if current.intersects(window):
                    current = current.difference(window.buffer(1))
            
            if isinstance(current, Polygon) and current.is_valid and current.area > 50:
                final_walls.append(current)
            elif isinstance(current, MultiPolygon):
                final_walls.extend([p for p in current.geoms if p.is_valid and p.area > 50])
        
        wall_polygons = final_walls if final_walls else wall_polygons
        print(f"  ✓ Final wall count: {len(wall_polygons)}")
    
    # Generate 3D mesh
    print("\nStep 7: Generating 3D mesh...")
    scene = create_3d_mesh_simple(wall_polygons, scale, wall_height)
    
    # Export GLB
    if output_glb:
        output_glb = Path(output_glb)
        output_glb.parent.mkdir(parents=True, exist_ok=True)
        
        glb_data = scene.export(file_type='glb')
        with open(output_glb, 'wb') as f:
            f.write(glb_data)
        
        print(f"  ✓ Exported to: {output_glb}")
    
    print(f"\n{'='*70}")
    print(f"✓ PIPELINE COMPLETE")
    print(f"  Walls: {len(wall_polygons)}")
    print(f"  Doors: {len(doors)}")
    print(f"  Windows: {len(windows)}")
    print(f"{'='*70}\n")
    
    return {
        'glb_path': str(output_glb) if output_glb else None,
        'wall_count': len(wall_polygons),
        'door_count': len(doors),
        'window_count': len(windows),
        'scene': scene
    }