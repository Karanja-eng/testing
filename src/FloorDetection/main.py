# backend/main.py
import io
import traceback
from typing import Tuple
from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2
import os

# try to import your utilities (these must be on PYTHONPATH)
try:
    from utils.FloorplanToBlenderLib import detect, transform
    from utils.post_prosessing import split_prediction, get_polygons

    # from utils.FloorplanToBlenderLib import polygons_to_image

    UTIL_OK = True
except Exception as e:
    UTIL_OK = False
    UTIL_IMPORT_ERR = str(e)

# pytesseract optional (OCR)
try:
    import pytesseract

    TESSERACT_OK = True
except Exception:
    TESSERACT_OK = False

# YOLO optional
try:
    from ultralytics import YOLO

    YOLO_OK = True
except Exception:
    YOLO_OK = False

YOLO_MODEL = None
if YOLO_OK and os.path.exists("best.pt"):
    try:
        YOLO_MODEL = YOLO("best.pt")
    except Exception:
        YOLO_MODEL = None

app = FastAPI(title="Floorplan Visual Backend - Fixed Rooms/Beams")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Helpers ----------
def pil_image_to_png_bytes(pil_img: Image.Image) -> bytes:
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def npimg_to_png_bytes(npimg: np.ndarray) -> bytes:
    # convert BGR -> RGB for Pillow
    if npimg.ndim == 3 and npimg.shape[2] == 3:
        npimg_rgb = cv2.cvtColor(npimg, cv2.COLOR_BGR2RGB)
    else:
        npimg_rgb = npimg
    pil = Image.fromarray(npimg_rgb)
    return pil_image_to_png_bytes(pil)


def error_image_bytes(msg: str, w: int = 1200, h: int = 600) -> bytes:
    pil = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(pil)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    lines = str(msg).splitlines()
    y = 10
    for line in lines:
        draw.text((10, y), line, fill=(180, 0, 0), font=font)
        y += 18
    return pil_image_to_png_bytes(pil)


def safe_run(fn):
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            tb = traceback.format_exc()
            print(tb)
            return error_image_bytes(f"{str(e)}\n\n{tb.splitlines()[-1] if tb else ''}")

    return wrapper


# ---------- Endpoints ----------
@app.post("/contours")
async def contours_endpoint(file: UploadFile = File(...)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        blank = np.ones((h, w, 3), np.uint8) * 255
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        contours, _ = detect.detectOuterContours(gray, blank.copy(), color=(0, 0, 0))
        if not isinstance(contours, list):
            contours = [contours]

        mask = np.zeros((h, w), np.uint8)
        cv2.drawContours(mask, contours, -1, 255, thickness=-1)

        stroke = 10
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (stroke, stroke))
        eroded = cv2.erode(mask, kernel)
        outline = cv2.subtract(mask, eroded)

        result = np.ones((h, w, 3), np.uint8) * 255
        ys, xs = np.where(outline == 255)
        result[ys, xs] = (0, 0, 0)
        return npimg_to_png_bytes(result)

    png = process(img)
    return Response(content=png, media_type="image/png")


@app.post("/rooms")
async def rooms_endpoint(file: UploadFile = File(...)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # filter for walls and invert
        wall_filtered = detect.wall_filter(gray)
        inv = ~wall_filtered

        # find rooms
        rooms, colored_rooms = detect.find_rooms(inv.copy())

        # detect precise boxes
        gray_rooms = cv2.cvtColor(colored_rooms, cv2.COLOR_BGR2GRAY)
        boxes, _ = detect.detectPreciseBoxes(gray_rooms, gray_rooms)

        # draw all room boxes on one canvas
        canvas = np.ones((h, w, 3), np.uint8) * 255
        for box in boxes:
            pts = np.array(box, dtype=np.int32).reshape(-1, 1, 2)
            cv2.polylines(canvas, [pts], True, (0, 0, 0), thickness=3)

        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")


@app.post("/walls")
async def walls_endpoint(file: UploadFile = File(...)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        wall_img = detect.wall_filter(gray)
        wall_inv = cv2.bitwise_not(wall_img)

        boxes, _ = detect.detectPreciseBoxes(wall_inv)

        canvas = np.ones((h, w, 3), np.uint8) * 255
        if wall_img is not None:
            if wall_img.ndim == 2:
                ys, xs = np.where(wall_img > 0)
                canvas[ys, xs] = (0, 0, 0)
            else:
                mask = cv2.cvtColor(wall_img, cv2.COLOR_BGR2GRAY)
                ys, xs = np.where(mask > 0)
                canvas[ys, xs] = (0, 0, 0)

        for box in boxes:
            pts = np.array(box, dtype=np.int32)
            if pts.ndim == 2:
                pts_draw = pts.reshape(-1, 1, 2)
            else:
                pts_draw = pts
            cv2.polylines(canvas, [pts_draw], True, (0, 0, 0), thickness=3)

        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")


@app.post("/slabs")
async def slabs_endpoint(file: UploadFile = File(...), scale: float = Query(0.01)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        wall_filtered = detect.wall_filter(gray)
        inv = ~wall_filtered
        rooms, colored_rooms = detect.find_rooms(inv.copy())

        gray_rooms = cv2.cvtColor(colored_rooms, cv2.COLOR_BGR2GRAY)
        boxes, _ = detect.detectPreciseBoxes(gray_rooms, gray_rooms)

        canvas = np.ones((h, w, 3), np.uint8) * 255
        for box in boxes:
            pts = np.array(box, dtype=np.int32).reshape(-1, 1, 2)
            cv2.polylines(canvas, [pts], True, (0, 0, 0), thickness=2)

            # decide slab type from bounding box
            x, y, bw, bh = cv2.boundingRect(pts)
            lx, ly = max(bw, bh) * scale, min(bw, bh) * scale
            slab_type = (
                "One-way slab" if (ly > 0 and (lx / ly) >= 2) else "Two-way slab"
            )
            cv2.putText(
                canvas,
                slab_type,
                (x, y - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 0, 0),
                2,
            )

        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")


# -------------------------------
# Beams Endpoint (corrected)
# -------------------------------
@app.post("/beams")
async def beams_endpoint(file: UploadFile = File(...), scale: float = Query(0.01)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 1) get wall mask (walls as white on black)
        wall_mask = detect.wall_filter(gray)

        # 2) close gaps (merge windows/doors into walls) on the white-wall mask
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        wall_closed = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        # 3) prepare for box detection: detectPreciseBoxes expects inverted mask (walls black on white)
        wall_closed_inv = cv2.bitwise_not(wall_closed)
        boxes, _ = detect.detectPreciseBoxes(wall_closed_inv)

        # 4) draw on white canvas (paint the closed-wall area black, then outlines)
        canvas = np.ones((h, w, 3), np.uint8) * 255
        if wall_closed is not None:
            ys, xs = np.where(wall_closed > 0)
            if ys.size > 0:
                canvas[ys, xs] = (0, 0, 0)

        for box in boxes:
            pts = np.array(box, dtype=np.int32)
            if pts.ndim == 2:
                pts_draw = pts.reshape(-1, 1, 2)
            else:
                pts_draw = pts
            cv2.polylines(canvas, [pts_draw], True, (0, 0, 0), thickness=3)

        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")


@app.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    if not TESSERACT_OK:
        return Response(
            content=error_image_bytes("pytesseract not installed on server"),
            media_type="image/png",
        )

    # set provided tesseract path
    pytesseract.pytesseract.tesseract_cmd = (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        text = pytesseract.image_to_string(gray)

        h, w = gray.shape[:2]
        pil = Image.new("RGB", (w, h), (255, 255, 255))
        draw = ImageDraw.Draw(pil)
        try:
            font = ImageFont.truetype("arial.ttf", 14)
        except Exception:
            font = ImageFont.load_default()
        y = 8
        for line in text.splitlines():
            draw.text((8, y), line, fill=(0, 0, 0), font=font)
            y += 18
        return pil_image_to_png_bytes(pil)

    png = process(img)
    return Response(content=png, media_type="image/png")


@app.post("/columns")
async def columns_endpoint(
    file: UploadFile = File(...), confidence: float = Query(0.5)
):
    if YOLO_MODEL is None:
        if not YOLO_OK:
            return Response(
                content=error_image_bytes("ultralytics YOLO not installed"),
                media_type="image/png",
            )
        return Response(
            content=error_image_bytes(
                "YOLO model file (best.pt) not found or failed to load"
            ),
            media_type="image/png",
        )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        results = YOLO_MODEL.predict(pil, conf=confidence)
        det = results[0]
        h, w = img.shape[:2]

        canvas = np.ones((h, w, 3), np.uint8) * 255
        for box in det.boxes:
            cls_name = YOLO_MODEL.names[int(box.cls)]
            if cls_name.lower() == "column":
                xy = box.xyxy[0].cpu().numpy().astype(int)
                x1, y1, x2, y2 = int(xy[0]), int(xy[1]), int(xy[2]), int(xy[3])
                cv2.rectangle(canvas, (x1, y1), (x2, y2), (0, 0, 0), thickness=3)
                cv2.putText(
                    canvas,
                    "Column",
                    (x1, y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 0, 0),
                    2,
                )
        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")
