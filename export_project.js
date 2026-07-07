const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = require("docx");

// ==================== CONFIGURATION ====================
// Directory paths to skip entirely to prevent massive document bloat
const IGNORE_FOLDERS = new Set([
    "node_modules", ".next", ".nest", "__pycache__",
    ".git", ".venv", "venv", "env", ".env", "dist", "build",
    "coverage", ".turbo", ".cache", ".idea", ".vscode",
    "out", "target", ".pytest_cache", ".mypy_cache"
]);

// Explicit file names to skip
const IGNORE_FILES = new Set([
    ".DS_Store", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "Thumbs.db", ".gitignore"
]);

// FIX: Use a DENYLIST of binary/asset extensions instead of an ALLOWLIST of
// text extensions. An allowlist silently drops any file type you forgot to
// list (.js, .jsx, .md, .yml, .html, .scss, .sql, etc. were all missing
// in the original), which is almost certainly why your export looked empty/partial.
const IGNORE_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp4", ".mov", ".avi", ".webm", ".mp3", ".wav",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".pdf", ".docx", ".xlsx", ".pptx",
    ".exe", ".dll", ".so", ".dylib", ".bin",
    ".pyc", ".class", ".o",
    ".map", ".lock",
    ".db", ".sqlite", ".sqlite3"
]);

// Max file size to embed (avoids huge dumps of minified/generated files)
const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB

// Formatting preferences
const OUTPUT_FILENAME = "Project_Codebase_Summary.docx";
const FONT_NAME = "Consolas";  // Monospace font for clean code layout
const ADD_LINE_NUMBERS = false;  // Set to true if you want line prefixes like [1] Code...
// =======================================================

const skippedLog = []; // FIX: track what got excluded and why, for visibility

/**
 * Determines if a file or directory should be processed based on exclusion rules.
 */
function shouldProcess(targetPath, rootDir) {
    const relativePath = path.relative(rootDir, targetPath);
    const parts = relativePath.split(path.sep);

    if (parts.some(part => IGNORE_FOLDERS.has(part))) {
        return false;
    }

    const filename = path.basename(targetPath);
    if (IGNORE_FILES.has(filename)) {
        return false;
    }

    // FIX: wrap stat in try/catch — broken symlinks or permission errors
    // previously threw uncaught and killed the whole run partway through.
    let stat;
    try {
        stat = fs.statSync(targetPath);
    } catch (err) {
        skippedLog.push(`${relativePath} (stat failed: ${err.message})`);
        return false;
    }

    if (stat.isFile()) {
        const ext = path.extname(targetPath).toLowerCase();
        if (IGNORE_EXTENSIONS.has(ext)) {
            return false;
        }
        if (stat.size > MAX_FILE_SIZE_BYTES) {
            skippedLog.push(`${relativePath} (too large: ${(stat.size / 1024).toFixed(0)}KB)`);
            return false;
        }
    }

    return true;
}

function generateDirectoryTree(rootDir, prefix = "") {
    let treeLines = [];
    if (!fs.existsSync(rootDir)) return treeLines;

    let items;
    try {
        items = fs.readdirSync(rootDir).map(name => {
            const fullPath = path.join(rootDir, name);
            let isDirectory = false;
            try {
                isDirectory = fs.statSync(fullPath).isDirectory();
            } catch {
                return null;
            }
            return { name, fullPath, isDirectory };
        }).filter(Boolean);
    } catch (err) {
        skippedLog.push(`${rootDir} (readdir failed: ${err.message})`);
        return treeLines;
    }

    items = items.filter(item => shouldProcess(item.fullPath, rootDir));

    items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    items.forEach((item, i) => {
        const isLast = (i === items.length - 1);
        const connector = isLast ? "└── " : "├── ";

        if (item.isDirectory) {
            treeLines.push(`${prefix}${connector}${item.name}/`);
            const extension = isLast ? "    " : "│   ";
            treeLines = treeLines.concat(generateDirectoryTree(item.fullPath, prefix + extension));
        } else {
            treeLines.push(`${prefix}${connector}${item.name}`);
        }
    });

    return treeLines;
}

function getAllFilesRecursive(dir, rootDir, fileList = []) {
    let items;
    try {
        items = fs.readdirSync(dir);
    } catch (err) {
        skippedLog.push(`${dir} (readdir failed: ${err.message})`);
        return fileList;
    }

    items.forEach(item => {
        const fullPath = path.join(dir, item);
        if (shouldProcess(fullPath, rootDir)) {
            let isDir = false;
            try {
                isDir = fs.statSync(fullPath).isDirectory();
            } catch {
                return;
            }
            if (isDir) {
                getAllFilesRecursive(fullPath, rootDir, fileList);
            } else {
                fileList.push(fullPath);
            }
        }
    });

    return fileList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

function formatPathHeader(rootPath, filePath) {
    const relative = path.relative(rootPath, filePath);
    return relative.split(path.sep).join(" > ");
}

async function main() {
    // FIX: allow overriding the target directory via CLI arg, since
    // __dirname only ever points at the script's own folder, not
    // necessarily the project root you want scanned.
    const rootDir = path.resolve(process.argv[2] || __dirname);
    const currentScriptFile = path.basename(__filename);

    console.log(` Scanning root: ${rootDir}`);

    const docChildren = [];

    docChildren.push(
        new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [
                new TextRun({
                    text: "Enterprise Codebase Documentation",
                    font: "Arial",
                    size: 44,
                    bold: true,
                    color: "0F766E"
                })
            ]
        }),
        new Paragraph({
            children: [
                new TextRun({
                    text: "Automatically compiled overview of target architecture directory structures and source code manifests.",
                    font: "Arial",
                    size: 21
                })
            ]
        }),
        new Paragraph({
            children: [new TextRun("-".repeat(80))]
        })
    );

    console.log(" 🛠️  Mapping project directories...");
    docChildren.push(
        new Paragraph({
            text: "1. Directory Tree Structure",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 }
        })
    );

    const treeLines = generateDirectoryTree(rootDir);

    docChildren.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: treeLines.join("\n") || "(no files found)",
                    font: FONT_NAME,
                    size: 19
                })
            ]
        }),
        new Paragraph({ children: [new PageBreak()] })
    );

    docChildren.push(
        new Paragraph({
            text: "2. Source File Manifests",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 }
        })
    );
    console.log(" 📂  Processing individual source code files...");

    const allFiles = getAllFilesRecursive(rootDir, rootDir);
    console.log(` Found ${allFiles.length} files to include.`);

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath);

        if (fileName === currentScriptFile || fileName === OUTPUT_FILENAME) {
            continue;
        }

        const customHeader = formatPathHeader(rootDir, filePath);
        console.log(`    Processing: ${customHeader}`);

        docChildren.push(
            new Paragraph({
                spacing: { before: 240, after: 60 },
                children: [
                    new TextRun({
                        text: `\n📂 ${customHeader}\n${"—".repeat(customHeader.length + 3)}`,
                        font: "Arial",
                        size: 24,
                        bold: true,
                        color: "B45309"
                    })
                ]
            })
        );

        try {
            const fileContent = fs.readFileSync(filePath, { encoding: "utf8" });
            const contentLines = fileContent.split(/\r?\n/);

            const codeRuns = [];
            contentLines.forEach((line, idx) => {
                const formattedLine = ADD_LINE_NUMBERS ? `[${idx + 1}] ${line}` : line;

                codeRuns.push(
                    new TextRun({
                        text: formattedLine,
                        break: idx > 0 ? 1 : undefined,
                        font: FONT_NAME,
                        size: 17,
                        color: "1E293B"
                    })
                );
            });

            docChildren.push(
                new Paragraph({
                    spacing: { after: 40, line: 276 },
                    children: codeRuns
                })
            );

        } catch (err) {
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `[Error reading file contents: ${err.message}]`,
                            italic: true,
                            color: "DC2626"
                        })
                    ]
                })
            );
        }
    }

    // FIX: append a log of skipped items so you can see exactly what was excluded
    if (skippedLog.length > 0) {
        docChildren.push(
            new Paragraph({ children: [new PageBreak()] }),
            new Paragraph({
                text: "3. Skipped Items Log",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 240, after: 120 }
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: skippedLog.join("\n"),
                        font: FONT_NAME,
                        size: 17
                    })
                ]
            })
        );
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: docChildren
        }]
    });

    try {
        const buffer = await Packer.toBuffer(doc);
        const outPath = path.join(rootDir, OUTPUT_FILENAME);
        fs.writeFileSync(outPath, buffer);
        console.log(`\n 🎉 Success! Document fully compiled and saved as: '${outPath}'`);
        if (skippedLog.length > 0) {
            console.log(` ⚠️  ${skippedLog.length} items were skipped — see section 3 in the doc, or the list below:`);
            skippedLog.forEach(s => console.log(`    - ${s}`));
        }
    } catch (writeErr) {
        console.error(`❌ Error compiling Word Document: ${writeErr.message}`);
    }
}

main();