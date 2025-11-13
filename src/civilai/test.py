from mesh_export import polygons_to_glb
from segmentation import segment_image

test_img = "uploads/YOUR_FILE_NAME.png"  # update filename
polygons = segment_image(test_img)
print("Polygons:", len(polygons))

polygons_to_glb(polygons, "test.glb")
print("✅ Export complete: test.glb")
