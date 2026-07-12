#!/usr/bin/env node
// Dependency-free load-sanity check. Fires a fixed concurrency at a URL for a duration and
// reports throughput + latency percentiles. For local/staging smoke only (not a benchmark).
// Usage: node scripts/load-sanity.mjs [url] [concurrency] [seconds]
//   e.g. node scripts/load-sanity.mjs http://localhost:4000/api/health 20 5
import http from 'node:http';
import https from 'node:https';

const url = process.argv[2] ?? 'http://localhost:4000/api/health';
const concurrency = Number(process.argv[3] ?? 20);
const seconds = Number(process.argv[4] ?? 5);
const client = url.startsWith('https') ? https : http;

const latencies = [];
let ok = 0;
let failed = 0;
const deadline = Date.now() + seconds * 1000;

function one() {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = client.get(url, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        latencies.push(ms);
        if (res.statusCode && res.statusCode < 500) ok += 1;
        else failed += 1;
        resolve();
      });
    });
    req.on('error', () => {
      failed += 1;
      resolve();
    });
  });
}

async function worker() {
  while (Date.now() < deadline) await one();
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const t0 = Date.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const elapsed = (Date.now() - t0) / 1000;
const total = ok + failed;

console.log(`load-sanity  ${url}`);
console.log(`  concurrency=${concurrency}  duration=${elapsed.toFixed(1)}s`);
console.log(`  requests=${total}  ok=${ok}  failed=${failed}  rps=${(total / elapsed).toFixed(0)}`);
console.log(`  latency ms  p50=${pct(latencies, 50).toFixed(1)}  p95=${pct(latencies, 95).toFixed(1)}  p99=${pct(latencies, 99).toFixed(1)}`);

process.exit(failed > 0 ? 1 : 0);
