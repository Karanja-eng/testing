// components/HatchTool.jsx
/**
 * Advanced Hatch Tool Implementation
 * Supports: Concrete, Steel, Soil, Sand, Gravel, Grass patterns
 */

import * as THREE from "three";

const HATCH_PATTERNS = {
  concrete: {
    name: "Concrete",
    pattern: "crosshatch",
    angle: 45,
    spacing: 10,
    lineWidth: 2,
    color: 0xcccccc,
    description: "Standard concrete pattern",
  },
  steel: {
    name: "Steel",
    pattern: "crosshatch",
    angle: 45,
    spacing: 5,
    lineWidth: 1.5,
    color: 0x999999,
    description: "Steel reinforcement",
  },
  soil: {
    name: "Soil",
    pattern: "dotted",
    angle: 0,
    spacing: 8,
    lineWidth: 1,
    color: 0x8b6914,
    description: "Natural soil",
  },
  sand: {
    name: "Sand",
    pattern: "sparse_dots",
    angle: 0,
    spacing: 12,
    lineWidth: 1,
    color: 0xd4a574,
    description: "Sand or aggregate",
  },
  gravel: {
    name: "Gravel",
    pattern: "random_dots",
    angle: 0,
    spacing: 10,
    lineWidth: 1,
    color: 0xa0a0a0,
    description: "Gravel",
  },
  grass: {
    name: "Grass",
    pattern: "vegetation",
    angle: 0,
    spacing: 15,
    lineWidth: 1,
    color: 0x90ee90,
    description: "Grass or vegetation",
  },
  water: {
    name: "Water",
    pattern: "wavy_lines",
    angle: 0,
    spacing: 12,
    lineWidth: 1.5,
    color: 0x4da6ff,
    description: "Water",
  },
  brick: {
    name: "Brick",
    pattern: "brick",
    angle: 45,
    spacing: 8,
    lineWidth: 1,
    color: 0xcd5c5c,
    description: "Brick masonry",
  },
};

/**
 * Create canvas texture for hatch pattern
 */
export function createHatchTexture(
  patternName,
  width = 256,
  height = 256,
  customOptions = {}
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  const pattern = HATCH_PATTERNS[patternName] || HATCH_PATTERNS.concrete;
  const options = { ...pattern, ...customOptions };

  // Fill background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Draw pattern based on type
  switch (options.pattern) {
    case "crosshatch":
      drawCrosshatchPattern(ctx, width, height, options);
      break;
    case "dotted":
      drawDottedPattern(ctx, width, height, options);
      break;
    case "sparse_dots":
      drawSparseDotPattern(ctx, width, height, options);
      break;
    case "random_dots":
      drawRandomDotPattern(ctx, width, height, options);
      break;
    case "vegetation":
      drawVegetationPattern(ctx, width, height, options);
      break;
    case "wavy_lines":
      drawWavyLinesPattern(ctx, width, height, options);
      break;
    case "brick":
      drawBrickPattern(ctx, width, height, options);
      break;
    default:
      drawCrosshatchPattern(ctx, width, height, options);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.repeat.set(1, 1);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

/**
 * Crosshatch pattern (for concrete, steel)
 */
function drawCrosshatchPattern(ctx, width, height, options) {
  const spacing = options.spacing || 10;
  const angle = ((options.angle || 45) * Math.PI) / 180;
  const lineWidth = options.lineWidth || 2;

  ctx.strokeStyle = `rgb(${(options.color >> 16) & 255}, ${
    (options.color >> 8) & 255
  }, ${options.color & 255})`;
  ctx.lineWidth = lineWidth;

  // First diagonal direction
  for (let i = -height; i < width; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  // Second diagonal direction (perpendicular)
  const angle2 = angle + Math.PI / 2;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(angle2 - angle);

  for (let i = -height; i < width; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Dotted pattern (for soil)
 */
function drawDottedPattern(ctx, width, height, options) {
  const spacing = options.spacing || 8;
  const radius = 2;

  ctx.fillStyle = `rgb(${(options.color >> 16) & 255}, ${
    (options.color >> 8) & 255
  }, ${options.color & 255})`;

  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Sparse dot pattern (for sand)
 */
function drawSparseDotPattern(ctx, width, height, options) {
  const spacing = options.spacing || 12;
  const radius = 1.5;

  ctx.fillStyle = `rgb(${(options.color >> 16) & 255}, ${
    (options.color >> 8) & 255
  }, ${options.color & 255})`;

  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      const offset = (Math.random() - 0.5) * spacing * 0.8;
      ctx.beginPath();
      ctx.arc(x + offset, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Random dot pattern (for gravel)
 */
function drawRandomDotPattern(ctx, width, height, options) {
  const spacing = options.spacing || 10;
  const dotDensity = 0.6;

  ctx.fillStyle = `rgb(${(options.color >> 16) & 255}, ${
    (options.color >> 8) & 255
  }, ${options.color & 255})`;

  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      if (Math.random() < dotDensity) {
        const radius = Math.random() * 2 + 1;
        const px = x + (Math.random() - 0.5) * spacing;
        const py = y + (Math.random() - 0.5) * spacing;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Vegetation pattern (for grass)
 */
function drawVegetationPattern(ctx, width, height, options) {
  const spacing = options.spacing || 15;

  ctx.strokeStyle = `rgb(${(options.color >> 16) & 255}, ${
    (options.color >> 8) & 255
  }, ${options.color & 255})`;
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += spacing) {
    for (let y = 0; y < height; y += spacing) {
      // Draw small grass tufts
      for (let i = 0; i < 3; i++) {
        const px = x + (Math.random() - 0.5) * spacing * 0.7;
        const py = y + (Math.random() - 0.5) * spacing * 0.7;
        const h = 5 + Math.random() * 3;
        const angle = Math.random() * Math.PI * 0.6 - Math.PI * 0.3;

        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + h * Math.cos(angle), py - h * Math.sin(angle));
        ctx.stroke();
      }
    }
  }
}

/**
 * Wavy lines pattern (for water)
 */
function drawWavyLinesPattern(ctx, width, height, options) {
  const spacing = options.spacing || 12;
  const amplitude = 3;

  ctx.strokeStyle = `rgb(${(options.color >> 16) & 255}, ${
    (options.color >> 8) & 255
  }, ${options.color & 255})`;
  ctx.lineWidth = options.lineWidth || 1.5;

  for (let y = 0; y < height; y += spacing) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 5) {
      const waveY = y + Math.sin((x / width) * Math.PI * 4) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, waveY);
      } else {
        ctx.lineTo(x, waveY);
      }
    }
    ctx.stroke();
  }
}

/**
 * Brick pattern (for masonry)
 */
function drawBrickPattern(ctx, width, height, options) {
  const brickWidth = 20;
  const brickHeight = 10;

  ctx.strokeStyle = `rgb(${(options.color >> 16) & 255}, ${
    (options.color >> 8) & 255
  }, ${options.color & 255})`;
  ctx.lineWidth = 1;

  for (let y = 0; y < height; y += brickHeight) {
    const offset = ((y / brickHeight) % 2) * (brickWidth / 2);

    for (let x = -brickWidth + offset; x < width; x += brickWidth) {
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + brickWidth, y);
      ctx.stroke();

      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + brickHeight);
      ctx.stroke();
    }
  }
}

/**
 * Apply hatch to polygon/boundary
 */
export function applyHatchToPolygon(points, patternName, options = {}) {
  const pattern = HATCH_PATTERNS[patternName] || HATCH_PATTERNS.concrete;
  const mergedOptions = { ...pattern, ...options };

  const geometry = new THREE.BufferGeometry();

  // Create vertices for polygon
  const vertices = [];
  for (const point of points) {
    vertices.push(point.x, point.y, 0);
  }

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(vertices), 3)
  );
  geometry.setIndex(
    new THREE.BufferAttribute(new Uint32Array(triangulate(points)), 1)
  );

  const texture = createHatchTexture(patternName, 256, 256, mergedOptions);
  const material = new THREE.MeshPhongMaterial({
    map: texture,
    color: mergedOptions.color,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

/**
 * Simple polygon triangulation (Ear clipping)
 */
function triangulate(points) {
  const indices = [];
  const n = points.length;

  if (n < 3) return indices;

  const verts = [...Array(n).keys()];
  let nv = n;

  let count = 0;
  while (nv > 2 && count < 10000) {
    count++;

    let u = nv - 1;
    let v = u + 1;
    if (v >= nv) v = 0;
    let w = v + 1;
    if (w >= nv) w = 0;

    let valid = true;

    const pu = points[verts[u]];
    const pv = points[verts[v]];
    const pw = points[verts[w]];

    const area =
      ((pv.x - pu.x) * (pw.y - pu.y) - (pw.x - pu.x) * (pv.y - pu.y)) / 2;

    if (area > -0.0001) {
      valid = true;

      for (let p = 0; p < nv; p++) {
        if (p === u || p === v || p === w) continue;

        const pp = points[verts[p]];

        const s1 = sign(pv, pw, pp);
        const s2 = sign(pw, pu, pp);
        const s3 = sign(pu, pv, pp);

        if (!((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0))) {
          valid = false;
          break;
        }
      }
    } else {
      valid = false;
    }

    if (valid) {
      indices.push(verts[u], verts[v], verts[w]);
      verts.splice(v, 1);
      nv--;
    }
  }

  return indices;
}

function sign(p1, p2, p3) {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

/**
 * Get pattern preview
 */
export function getPatternPreview(patternName) {
  const pattern = HATCH_PATTERNS[patternName];
  if (!pattern) return null;

  return {
    name: pattern.name,
    description: pattern.description,
    preview: createHatchTexture(patternName, 128, 128),
  };
}

/**
 * List all available patterns
 */
export function getAvailablePatterns() {
  return Object.entries(HATCH_PATTERNS).map(([key, pattern]) => ({
    id: key,
    name: pattern.name,
    description: pattern.description,
  }));
}

/**
 * Export hatch object for saving
 */
export function exportHatchObject(id, points, patternName, options = {}) {
  return {
    id,
    type: "hatch",
    pattern: patternName,
    points: points.map((p) => ({ x: p.x, y: p.y, z: p.z || 0 })),
    options: {
      angle: options.angle || HATCH_PATTERNS[patternName].angle,
      scale: options.scale || 1.0,
      color: options.color || HATCH_PATTERNS[patternName].color,
    },
    timestamp: Date.now(),
  };
}
