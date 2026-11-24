// Platform adapter for @corbet/harness-core: the only file in this package that
// may touch Node built-ins. Everything else in src/ uses only web-standard types
// (Uint8Array, TextEncoder) plus this adapter, so the core can later run on Deno
// against a different adapter with the same function signatures.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** SHA-256 of bytes, as lowercase hex. */
export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** UTF-8 bytes of text. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Base64 bytes of a base64 string. Throws when the input is not valid base64. */
export function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

/** Base64 string of bytes. */
export function bytesToBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

/** Reads a text file as UTF-8. Throws when the file cannot be read. */
export function readTextFile(path: string): string {
  return readFileSync(path, "utf8");
}

/** Reads a file as bytes. Throws when the file cannot be read. */
export function readBinaryFile(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path));
}

/** True when a file exists at path. */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Creates the parent directory of path, like `mkdir -p`. */
export function ensureDirFor(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

/** Writes text to a new file. Throws when the file already exists. */
export function writeNewTextFile(path: string, text: string): void {
  writeFileSync(path, text, { encoding: "utf8", flag: "wx" });
}

/** Appends UTF-8 text to a file. Throws when the file cannot be written. */
export function appendTextFile(path: string, text: string): void {
  appendFileSync(path, text, "utf8");
}

/** Joins path segments the way the receipt's relative paths expect. */
export function joinPath(dir: string, rel: string): string {
  return join(dir, rel);
}

/** Generates a fresh Ed25519 private key, exported as a PKCS#8 PEM string. */
export function generateEd25519PrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return String(privateKey.export({ type: "pkcs8", format: "pem" }));
}

/** DER SPKI bytes of the Ed25519 public key for a PKCS#8 PEM private key, as base64. */
export function ed25519PublicKeyDerBase64(privateKeyPem: string): string {
  const privateKey = createPrivateKey(privateKeyPem);
  return createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");
}

/** Signs bytes with an Ed25519 PKCS#8 PEM private key. Deterministic: no nonce. */
export function ed25519Sign(bytes: Uint8Array, privateKeyPem: string): Uint8Array {
  return new Uint8Array(sign(null, bytes, createPrivateKey(privateKeyPem)));
}

/** Verifies an Ed25519 signature against DER SPKI base64 public key bytes. Throws on a bad key. */
export function ed25519Verify(bytes: Uint8Array, signature: Uint8Array, publicKeyDerBase64: string): boolean {
  const key = createPublicKey({ key: Buffer.from(publicKeyDerBase64, "base64"), format: "der", type: "spki" });
  return verify(null, bytes, key, signature);
}

/** Parses DER SPKI base64 Ed25519 public key bytes and discards the result. Throws on a bad key. */
export function assertEd25519PublicKeyDerBase64(publicKeyDerBase64: string): void {
  createPublicKey({ key: Buffer.from(publicKeyDerBase64, "base64"), format: "der", type: "spki" });
}
