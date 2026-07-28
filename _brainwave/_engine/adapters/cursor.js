#!/usr/bin/env node
"use strict";

const { buildSessionContext, hookInput, writeJson } = require("../runtime/brainwave_runtime");

const event = process.argv[2];
const { runtime } = hookInput(__dirname);

if (event !== "session-start") {
  writeJson({ continue: true });
} else {
  const additionalContext = buildSessionContext(runtime);
  writeJson(
    additionalContext
      ? { continue: true, additional_context: additionalContext }
      : { continue: true }
  );
}
