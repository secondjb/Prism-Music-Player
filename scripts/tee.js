import fs from 'node:fs';

const logPath = process.argv[2] || 'dev-output.log';
fs.writeFileSync(logPath, '', 'utf8');

// Match standard ANSI escape sequences
const ansiRegex = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

process.stdin.on('data', (chunk) => {
  // Live console gets raw stream with original colors
  process.stdout.write(chunk);
  // Log file gets clean UTF-8 text immediately flushed
  const text = chunk.toString('utf8');
  const clean = text.replace(ansiRegex, '');
  try {
    fs.appendFileSync(logPath, clean, 'utf8');
  } catch {}
});

// Handle graceful exit
process.on('SIGINT', () => {
  process.exit(0);
});
process.on('SIGTERM', () => {
  process.exit(0);
});
