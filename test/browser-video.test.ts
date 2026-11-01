import assert from "node:assert/strict";
import { test } from "node:test";
import { videoUnavailableReason } from "../src/browser.js";

test("a missing ffmpeg is reported as the recording failure", () => {
  const err = new Error(
    "browserContext.newPage: Executable doesn't exist at C:\\Users\\x\\AppData\\Local\\ms-playwright\\ffmpeg-1013\\ffmpeg-win64.exe\nCall log:\n- <launching>",
  );
  assert.equal(
    videoUnavailableReason(err),
    "browserContext.newPage: Executable doesn't exist at C:\\Users\\x\\AppData\\Local\\ms-playwright\\ffmpeg-1013\\ffmpeg-win64.exe",
  );
});

test("other page errors are not mistaken for a video problem", () => {
  assert.equal(videoUnavailableReason(new Error("Target page, context or browser has been closed")), null);
  assert.equal(videoUnavailableReason("no process"), null);
  assert.equal(videoUnavailableReason(undefined), null);
});
