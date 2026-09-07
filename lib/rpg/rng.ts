// mulberry32-v1: unsigned 32-bit state, independently salted streams. All draws
// mutate a cloned transaction only. Cryptographic seed creation is outside it.
export type RngState = {
  algorithm: "mulberry32-v1";
  initialization: number;
  gameplay: number;
  narrative: number;
};
export type Stream = "initialization" | "gameplay" | "narrative";
export type Draw = (stream?: Stream) => number;
export const seedRng = (seed: number): RngState => ({
  algorithm: "mulberry32-v1",
  initialization: seed >>> 0,
  gameplay: (seed ^ 0x9e3779b9) >>> 0,
  narrative: (seed ^ 0x85ebca6b) >>> 0,
});
export function draw(rng: RngState, stream: Stream = "gameplay"): number {
  rng[stream] = (rng[stream] + 0x6d2b79f5) >>> 0;
  let t = rng[stream];
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const freshSeed = () =>
  globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
