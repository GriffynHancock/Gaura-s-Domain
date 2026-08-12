// Extracts the DOM-free algorithm core (strToBytes .. keccak256WithTrace) out of
// public/crypto/hash/index.html's inline <script> and runs it in a fresh vm context, so its
// digest/trace functions can be unit-tested from Node without a browser or DOM stubs. The core
// is bounded by two markers that are already present in the file and are not touched by any
// task in this plan except to add code *within* the boundary (new trace fields, new consts).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const START_MARKER = 'function strToBytes';
const END_MARKER = '// ---- theme toggle ----';

export function loadHashCore(htmlPathUrl) {
  const html = readFileSync(htmlPathUrl, 'utf8');
  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(
      `could not locate hash-core script boundaries (markers "${START_MARKER}" / "${END_MARKER}") in ${htmlPathUrl}`
    );
  }
  const code = html.slice(startIdx, endIdx);
  const sandbox = { TextEncoder, TextDecoder, BigInt, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'hash-core.js' });
  return sandbox;
}
