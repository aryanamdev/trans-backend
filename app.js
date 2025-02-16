const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");
const cors = require("cors");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const PORT = 9090;
const OUTPUT_DIR = "output";

// Mapping of columns to language folder names
const LANGUAGE_MAP = ["en-US", "ar-AE", "el-GR", "es-ES", "fr-FR", "hi-IN"];

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on("data", (row) => results.push(row))
    .on("end", async () => {
      await fs.remove(OUTPUT_DIR);
      await fs.ensureDir(OUTPUT_DIR);

      if (results.length === 0) {
        return res.status(400).json({ error: "CSV is empty" });
      }

      const headers = Object.keys(results[0]);
      const idColumn = headers[0]; // First column is the ID
      const languageColumns = headers.slice(1); // Remaining columns are language keys

      // Ensure we only process the required languages in order
      const filteredLanguages = languageColumns.filter(
        (_, index) => index !== 2
      ); // Skip the fourth column
      const mappedLanguages = LANGUAGE_MAP.slice(0, filteredLanguages.length);

      mappedLanguages.forEach((lang, index) => {
        const langDir = path.join(OUTPUT_DIR, lang);
        fs.ensureDirSync(langDir);
        const messages = {};

        results.forEach((row) => {
          messages[row[idColumn]] = row[filteredLanguages[index]];
        });

        fs.writeJsonSync(path.join(langDir, "messages.json"), messages, {
          spaces: 2,
        });
      });

      // Zip the directory
      const zipPath = path.join(__dirname, "translations.zip");
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip");

      output.on("close", () => {
        res.download(zipPath, "translations.zip", () => {
          fs.unlinkSync(zipPath);
        });
      });

      archive.pipe(output);
      archive.directory(OUTPUT_DIR, false);
      archive.finalize();
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
