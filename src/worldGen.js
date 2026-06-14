export function getWallData(x, z, seed = 1337) {
  // A fast and reliable 32-bit integer hash function (Murmur3 style mixing)
  function hash(n) {
    let s = n ^ seed;
    s ^= s >>> 16;
    s = Math.imul(s, 0x85ebca6b);
    s ^= s >>> 13;
    s = Math.imul(s, 0xc2b2ae35);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296; // Normalize to 0-1
  }
  
  // We use prime numbers to avoid symmetry across axes and ensure independent bits
  // Math.imul handles 32-bit multiplication safely, even with negative coordinates
  const mixX = Math.imul(x, 73856093) ^ Math.imul(z, 19349663);
  const mixZ = Math.imul(x, 19349663) ^ Math.imul(z, 83492791);
  const mixL = Math.imul(x, 83492791) ^ Math.imul(z, 73856093);

  return {
    northWall: hash(mixX) > 0.5, // Actually Wall X
    westWall: hash(mixZ) > 0.5,  // Actually Wall Z
    hasFixture: hash(mixL) > 0.7,
    isFixtureOn: hash(mixL) > 0.97
  };
}
