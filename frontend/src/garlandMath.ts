export type Point = { x: number; y: number };

// Each wire segment is a cubic Bézier through the attachment points, so gifts, bulbs and wire stay aligned.
export function segment(points: Point[], index: number): [Point, Point, Point, Point] {
  const start = points[index - 1];
  const point = points[index];
  const before = points[Math.max(0, index - 2)];
  const after = points[Math.min(points.length - 1, index + 1)];
  return [start,
    { x: start.x + (point.x - before.x) / 6, y: start.y + (point.y - before.y) / 6 },
    { x: point.x - (after.x - start.x) / 6, y: point.y - (after.y - start.y) / 6 },
    point];
}

export function bezier([a, b, c, d]: [Point, Point, Point, Point], t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}
