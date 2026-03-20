const fs = require("fs");
const {google} = require("googleapis");

// Parse .env.local manually
const envContent = fs.readFileSync("/sessions/charming-modest-pasteur/mnt/Desktop/campaign-timeline-viewer/.env.local", "utf8");
const env = {};
const lines = envContent.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line || line.startsWith("#")) continue;
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) continue;
  const key = line.substring(0, eqIdx);
  let val = line.substring(eqIdx + 1);
  // Handle multiline values (private key)
  if (val.startsWith('"') && !val.endsWith('"')) {
    while (i + 1 < lines.length && !lines[i + 1].includes('"')) {
      i++;
      val += "\n" + lines[i];
    }
    if (i + 1 < lines.length) {
      i++;
      val += "\n" + lines[i];
    }
  }
  val = val.replace(/^"|"$/g, "");
  env[key] = val;
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

(async () => {
  const sheets = google.sheets({version: "v4", auth});
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.REGISTRY_SPREADSHEET_ID,
    range: "campaign_registry!A2:G10",
  });
  console.log(JSON.stringify(res.data.values, null, 2));
})();
