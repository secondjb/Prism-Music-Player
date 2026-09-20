import fs from 'node:fs';

const logPath = process.argv[2] || 'dev-output.log';
const logStream = fs.createWriteStream(logPath, { flags: 'w', encoding: 'utf8' });

// Match standard ANSI escape sequences
const ansiRegex = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d\/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g;

process.stdin.on('data', (chunk) => {
  // Live console gets raw stream with original colors
  process.stdout.write(chunk);
  // Log file gets clean UTF-8 text without cluttering escape sequences
  const text = chunk.toString('utf8');
  const clean = text.replace(ansiRegex, '');
  logStream.write(clean);
});

process.stdin.on('end', () => {
  logStream.end();
});

// Handle graceful exit
process.on('SIGINT', () => {
  logStream.end();
  process.exit(0);
});
process.on('SIGTERM', () => {
  logStream.end();
  process.exit(0);
});
