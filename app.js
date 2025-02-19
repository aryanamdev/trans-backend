"use strict";
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
      const idColumn = headers[0];
      const languageColumns = headers.slice(1);

      languageColumns.forEach((lang, index) => {
        const langDir = path.join(OUTPUT_DIR, lang);
        fs.ensureDirSync(langDir);
        const messages = {};

        results.forEach((row) => {
          messages[row[idColumn]] = row[languageColumns[index]];
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
