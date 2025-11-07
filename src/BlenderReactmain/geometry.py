# backend/geometry.py
"""
Advanced geometry utilities for AutoCAD Clone
Handles calculations for measurements, intersections, and transformations
"""

import math
import numpy as np
from typing import List, Tuple, Optional, Dict
from dataclasses import dataclass


@dataclass
class Point:
    x: float
    y: float
    z: float = 0.0


@dataclass
class Line:
    start: Point
    end: Point


@dataclass
class Circle:
    center: Point
    radius: float


@dataclass
class Rectangle:
    p1: Point
    p2: Point


@dataclass
class Arc:
    center: Point
    radius: float
    start_angle: float
    end_angle: float


# ============ Distance & Measurement ============


def distance(p1: Point, p2: Point) -> float:
    """Calculate Euclidean distance between two points"""
    return math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2)


def line_length(line: Line) -> float:
    """Calculate length of a line"""
    return distance(line.start, line.end)


def circle_area(circle: Circle) -> float:
    """Calculate area of a circle"""
    return math.pi * circle.radius**2


def circle_circumference(circle: Circle) -> float:
    """Calculate circumference of a circle"""
    return 2 * math.pi * circle.radius


def rectangle_area(rect: Rectangle) -> float:
    """Calculate area of rectangle"""
    width = abs(rect.p2.x - rect.p1.x)
    height = abs(rect.p2.y - rect.p1.y)
    return width * height


def rectangle_perimeter(rect: Rectangle) -> float:
    """Calculate perimeter of rectangle"""
    width = abs(rect.p2.x - rect.p1.x)
    height = abs(rect.p2.y - rect.p1.y)
    return 2 * (width + height)


def polygon_area(points: List[Point]) -> float:
    """Calculate polygon area using Shoelace formula"""
    if len(points) < 3:
        return 0

    area = 0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        area += points[i].x * points[j].y
        area -= points[j].x * points[i].y

    return abs(area) / 2


def polygon_perimeter(points: List[Point]) -> float:
    """Calculate polygon perimeter"""
    if len(points) < 2:
        return 0

    perimeter = 0
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        perimeter += distance(points[i], points[j])

    return perimeter


def arc_length(arc: Arc) -> float:
    """Calculate arc length"""
    angle_diff = abs(arc.end_angle - arc.start_angle)
    return arc.radius * angle_diff


# ============ Intersections ============


def line_line_intersection(line1: Line, line2: Line) -> Optional[Point]:
    """Find intersection point of two lines"""
    x1, y1 = line1.start.x, line1.start.y
    x2, y2 = line1.end.x, line1.end.y
    x3, y3 = line2.start.x, line2.start.y
    x4, y4 = line2.end.x, line2.end.y

    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)

    if abs(denom) < 1e-10:
        return None  # Lines are parallel

    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom

    x = x1 + t * (x2 - x1)
    y = y1 + t * (y2 - y1)

    return Point(x, y)


def line_circle_intersection(line: Line, circle: Circle) -> List[Point]:
    """Find intersection points of line and circle"""
    # Line parameterization: P = start + t(end - start)
    dx = line.end.x - line.start.x
    dy = line.end.y - line.start.y

    fx = line.start.x - circle.center.x
    fy = line.start.y - circle.center.y

    a = dx * dx + dy * dy
    b = 2 * (fx * dx + fy * dy)
    c = fx * fx + fy * fy - circle.radius * circle.radius

    discriminant = b * b - 4 * a * c

    if discriminant < 0:
        return []  # No intersection

    intersections = []
    sqrt_disc = math.sqrt(discriminant)

    for t in [(-b - sqrt_disc) / (2 * a), (-b + sqrt_disc) / (2 * a)]:
        if 0 <= t <= 1:
            x = line.start.x + t * dx
            y = line.start.y + t * dy
            intersections.append(Point(x, y))

    return intersections


def circle_circle_intersection(c1: Circle, c2: Circle) -> List[Point]:
    """Find intersection points of two circles"""
    d = distance(c1.center, c2.center)

    # Check if circles don't intersect
    if d > c1.radius + c2.radius or d < abs(c1.radius - c2.radius) or d == 0:
        return []

    a = (c1.radius**2 - c2.radius**2 + d**2) / (2 * d)
    h = math.sqrt(c1.radius**2 - a**2)

    # Point on line between centers
    px = c1.center.x + a * (c2.center.x - c1.center.x) / d
    py = c1.center.y + a * (c2.center.y - c1.center.y) / d

    # Perpendicular offset
    offset_x = -h * (c2.center.y - c1.center.y) / d
    offset_y = h * (c2.center.x - c1.center.x) / d

    p1 = Point(px + offset_x, py + offset_y)
    p2 = Point(px - offset_x, py - offset_y)

    return [p1, p2]


# ============ Transformations ============


def translate_point(point: Point, dx: float, dy: float, dz: float = 0) -> Point:
    """Translate point by delta values"""
    return Point(point.x + dx, point.y + dy, point.z + dz)


def rotate_point(point: Point, center: Point, angle_degrees: float) -> Point:
    """Rotate point around center by angle (in degrees)"""
    angle_rad = math.radians(angle_degrees)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)

    # Translate to origin
    x = point.x - center.x
    y = point.y - center.y

    # Rotate
    rotated_x = x * cos_a - y * sin_a
    rotated_y = x * sin_a + y * cos_a

    # Translate back
    return Point(rotated_x + center.x, rotated_y + center.y)


def scale_point(point: Point, center: Point, scale: float) -> Point:
    """Scale point relative to center"""
    return Point(
        center.x + (point.x - center.x) * scale,
        center.y + (point.y - center.y) * scale,
        center.z + (point.z - center.z) * scale,
    )


def mirror_point(
    point: Point, mirror_line_start: Point, mirror_line_end: Point
) -> Point:
    """Mirror point across a line"""
    # Vector along mirror line
    lx = mirror_line_end.x - mirror_line_start.x
    ly = mirror_line_end.y - mirror_line_start.y

    # Normalize
    len_l = math.sqrt(lx * lx + ly * ly)
    lx /= len_l
    ly /= len_l

    # Vector from line start to point
    px = point.x - mirror_line_start.x
    py = point.y - mirror_line_start.y

    # Project point onto line
    dot = px * lx + py * ly
    proj_x = mirror_line_start.x + dot * lx
    proj_y = mirror_line_start.y + dot * ly

    # Reflect
    mirror_x = 2 * proj_x - point.x
    mirror_y = 2 * proj_y - point.y

    return Point(mirror_x, mirror_y)


def offset_line(line: Line, distance: float) -> Tuple[Line, Line]:
    """Create parallel lines at distance from original"""
    # Direction vector
    dx = line.end.x - line.start.x
    dy = line.end.y - line.start.y
    length = math.sqrt(dx * dx + dy * dy)

    # Perpendicular vector
    perp_x = -dy / length * distance
    perp_y = dx / length * distance

    # Offset lines
    line1 = Line(
        Point(line.start.x + perp_x, line.start.y + perp_y),
        Point(line.end.x + perp_x, line.end.y + perp_y),
    )

    line2 = Line(
        Point(line.start.x - perp_x, line.start.y - perp_y),
        Point(line.end.x - perp_x, line.end.y - perp_y),
    )

    return line1, line2


# ============ Snap Points ============


def find_snap_points(geometry: dict) -> List[Tuple[Point, str]]:
    """
    Find all snap-able points on a geometry
    Returns list of (Point, snap_type) tuples
    """
    snap_points = []

    if geometry["type"] == "line":
        line = Line(
            Point(geometry["start"]["x"], geometry["start"]["y"]),
            Point(geometry["end"]["x"], geometry["end"]["y"]),
        )
        snap_points.append((line.start, "endpoint"))
        snap_points.append((line.end, "endpoint"))

        midpoint = Point(
            (line.start.x + line.end.x) / 2, (line.start.y + line.end.y) / 2
        )
        snap_points.append((midpoint, "midpoint"))

    elif geometry["type"] == "circle":
        circle = Circle(
            Point(geometry["center"]["x"], geometry["center"]["y"]), geometry["radius"]
        )
        snap_points.append((circle.center, "center"))

    elif geometry["type"] == "rectangle":
        p1 = Point(geometry["start"]["x"], geometry["start"]["y"])
        p2 = Point(geometry["end"]["x"], geometry["end"]["y"])

        corners = [p1, Point(p2.x, p1.y), p2, Point(p1.x, p2.y)]

        for corner in corners:
            snap_points.append((corner, "endpoint"))

        center = Point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
        snap_points.append((center, "center"))

    return snap_points


# ============ Point Testing ============


def point_in_circle(point: Point, circle: Circle) -> bool:
    """Check if point is inside circle"""
    return distance(point, circle.center) <= circle.radius


def point_in_rectangle(point: Point, rect: Rectangle) -> bool:
    """Check if point is inside rectangle"""
    min_x = min(rect.p1.x, rect.p2.x)
    max_x = max(rect.p1.x, rect.p2.x)
    min_y = min(rect.p1.y, rect.p2.y)
    max_y = max(rect.p1.y, rect.p2.y)

    return min_x <= point.x <= max_x and min_y <= point.y <= max_y


def point_in_polygon(point: Point, polygon: List[Point]) -> bool:
    """Check if point is inside polygon (ray casting algorithm)"""
    x, y = point.x, point.y
    n = len(polygon)
    inside = False

    j = n - 1
    for i in range(n):
        xi, yi = polygon[i].x, polygon[i].y
        xj, yj = polygon[j].x, polygon[j].y

        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside

        j = i

    return inside


# ============ Bounding Box ============


def get_bounding_box(geometries: List[dict]) -> Dict:
    """Get bounding box for multiple geometries"""
    if not geometries:
        return {"min_x": 0, "min_y": 0, "max_x": 0, "max_y": 0}

    all_points = []

    for geom in geometries:
        if geom["type"] == "line":
            all_points.append(Point(geom["start"]["x"], geom["start"]["y"]))
            all_points.append(Point(geom["end"]["x"], geom["end"]["y"]))

        elif geom["type"] == "circle":
            c = Point(geom["center"]["x"], geom["center"]["y"])
            r = geom["radius"]
            all_points.extend(
                [
                    Point(c.x - r, c.y),
                    Point(c.x + r, c.y),
                    Point(c.x, c.y - r),
                    Point(c.x, c.y + r),
                ]
            )

        elif geom["type"] == "rectangle":
            all_points.append(Point(geom["start"]["x"], geom["start"]["y"]))
            all_points.append(Point(geom["end"]["x"], geom["end"]["y"]))

    xs = [p.x for p in all_points]
    ys = [p.y for p in all_points]

    return {
        "min_x": min(xs),
        "max_x": max(xs),
        "min_y": min(ys),
        "max_y": max(ys),
        "width": max(xs) - min(xs),
        "height": max(ys) - min(ys),
    }


# ============ Angle Calculations ============


def angle_between_points(p1: Point, p2: Point) -> float:
    """Calculate angle between two points (in degrees)"""
    dx = p2.x - p1.x
    dy = p2.y - p1.y
    return math.degrees(math.atan2(dy, dx))


def angle_at_point(p1: Point, vertex: Point, p3: Point) -> float:
    """Calculate angle at vertex formed by three points"""
    angle1 = angle_between_points(vertex, p1)
    angle2 = angle_between_points(vertex, p3)
    angle = abs(angle2 - angle1)
    return min(angle, 360 - angle)


# ============ Perpendicular Distance ============


def point_to_line_distance(point: Point, line: Line) -> float:
    """Calculate perpendicular distance from point to line"""
    x1, y1 = line.start.x, line.start.y
    x2, y2 = line.end.x, line.end.y
    x0, y0 = point.x, point.y

    numerator = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
    denominator = math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2)

    if denominator == 0:
        return distance(point, line.start)

    return numerator / denominator


# ============ Utilities ============


def simplify_polyline(points: List[Point], tolerance: float = 1.0) -> List[Point]:
    """Simplify polyline using Douglas-Peucker algorithm"""
    if len(points) <= 2:
        return points

    # Find point with max distance from line
    start = points[0]
    end = points[-1]
    line = Line(start, end)

    max_dist = 0
    max_idx = 0

    for i in range(1, len(points) - 1):
        dist = point_to_line_distance(points[i], line)
        if dist > max_dist:
            max_dist = dist
            max_idx = i

    if max_dist > tolerance:
        # Recursive simplification
        left = simplify_polyline(points[: max_idx + 1], tolerance)
        right = simplify_polyline(points[max_idx:], tolerance)
        return left[:-1] + right
    else:
        return [start, end]
