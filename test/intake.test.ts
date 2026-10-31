import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWav, toMono16k } from "../src/intake.js";

function wav(sampleRate: number, channels: number, frames: number): Buffer {
  const data = Buffer.alloc(frames * channels * 2);
  for (let f = 0; f < frames; f++) for (let c = 0; c < channels; c++) data.writeInt16LE(c === 0 ? 1000 : 3000, (f * channels + c) * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "ascii"); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8, "ascii");
  h.write("fmt ", 12, "ascii"); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36, "ascii"); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

test("parses a 16-bit PCM WAV", () => {
  const pcm = parseWav(wav(22050, 1, 100));
  assert.equal(pcm.sampleRate, 22050);
  assert.equal(pcm.channels, 1);
  assert.equal(pcm.samples.length, 100);
});

test("converts stereo 44.1 kHz to mono 16 kHz, averaging channels", () => {
  const out = parseWav(toMono16k(parseWav(wav(44100, 2, 44100))));   // one second
  assert.equal(out.sampleRate, 16000);
  assert.equal(out.channels, 1);
  assert.equal(out.samples.length, 16000);
  assert.equal(out.samples[100], 2000);                                // (1000 + 3000) / 2
});

test("rejects non-WAV and non-16-bit input", () => {
  assert.throws(() => parseWav(Buffer.from("not a wav file at all, definitely not")), /not a WAV/);
  const eightBit = wav(16000, 1, 10);
  eightBit.writeUInt16LE(8, 34);
  assert.throws(() => parseWav(eightBit), /16-bit PCM/);
});
