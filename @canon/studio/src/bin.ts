#!/usr/bin/env node
import { argv } from "node:process";

import { main } from "./server.js";

// Serving outlives this line: the code goes into exitCode and not into
// exit(), or the server would be shut down as it starts listening.
process.exitCode = main(argv.slice(2));
