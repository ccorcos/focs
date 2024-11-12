export function normalizeFilename(filename: string): string {
  return decodeURIComponent(filename)
    .replace(/["']/g, "")
    .replace(/[^a-zA-Z0-9.-\s]/g, "_");
}

if (require.main === module) {
  const filepath = process.argv[2];
  if (!filepath) {
    console.error("Please provide a filepath");
    process.exit(1);
  }

  const path = require("path");
  const oldName = path.basename(filepath);
  const newName = normalizeFilename(oldName);
  console.log(newName);
}
