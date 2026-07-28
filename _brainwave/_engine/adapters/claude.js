#!/usr/bin/env node
"use strict";

const { buildSessionContext, hookInput, writeJson } = require("../runtime/brainwave_runtime");

const event = process.argv[2];
const { runtime } = hookInput(__dirname);
const additionalContext = event === "session-start" ? buildSessionContext(runtime) : null;

writeJson(
  additionalContext
    ? {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext
        }
      }
    : {}
);
