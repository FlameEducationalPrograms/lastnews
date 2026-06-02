const sheetUrl =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7OE6IrI6mRhSuWFmEQel_cjsrZefWBRJpGMESvFt7ivgyIjvmMwu3vAsEzALqNUrPm5Ve4jczbSSu/pub?gid=1863532918&single=true&output=csv";

const newsGrid = document.querySelector("#newsGrid");
const statusMessage = document.querySelector("#statusMessage");
const refreshButton = document.querySelector("#refreshNews");

function setStatus(message, visible = true) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-visible", visible);
}

function getCell(row, aliases, fallbackIndex) {
  for (const alias of aliases) {
    if (row[alias]) {
      return row[alias];
    }
  }

  return Number.isInteger(fallbackIndex) ? row.__cells[fallbackIndex] || "" : "";
}

function normalizeHeader(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsv(csv) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.map((cells) => cells.map((cell) => cell.trim()));
}

function parseSheet(csv) {
  const rows = parseCsv(csv).filter((cells) => cells.some(Boolean));
  const headers = (rows.shift() || []).map(normalizeHeader);

  return rows
    .map((cells) => {
      const row = { __cells: cells };
      headers.forEach((header, index) => {
        if (header) {
          row[header] = cells[index] || "";
        }
      });

      const description = getCell(row, ["description", "details", "body", "message", "content"], 3);
      const lines = description.split(/\n+/).map((line) => line.trim()).filter(Boolean);

      return {
        date: getCell(row, ["news date", "date", "day", "time"], 1),
        title: getCell(row, ["title", "news", "headline", "subject"]) || lines[0] || "News update",
        body: lines.length > 1 ? lines.slice(1).join("\n") : "",
        image: getCell(row, ["publicimageurl", "public image url", "image url", "image"], 4),
        link: getCell(row, ["link", "url"]),
        visible: getCell(row, ["showonwebsite", "show on website", "visible"], 5),
      };
    })
    .filter((item) => item.visible.toLowerCase() !== "false" && item.visible.toLowerCase() !== "no")
    .filter((item) => item.title || item.body)
    .slice(0, 12);
}

function createNewsCard(item) {
  const article = document.createElement("article");
  article.className = "news-card";

  if (/^https?:\/\//i.test(item.image)) {
    const imageWrap = document.createElement("div");
    imageWrap.className = "news-image";

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.title;
    image.loading = "lazy";

    imageWrap.append(image);
    article.append(imageWrap);
  }

  if (item.date) {
    const date = document.createElement("p");
    date.className = "news-date";
    date.textContent = item.date;
    article.append(date);
  }

  const title = document.createElement("h3");
  title.className = "news-title";
  title.textContent = item.title || "Service update";
  article.append(title);

  if (item.body) {
    const body = document.createElement("p");
    body.className = "news-body";
    body.textContent = item.body;
    article.append(body);
  }

  if (/^https?:\/\//i.test(item.link)) {
    const link = document.createElement("a");
    link.className = "news-link";
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Read more";
    article.append(link);
  }

  return article;
}

async function loadNews() {
  newsGrid.innerHTML = "";
  refreshButton.disabled = true;
  setStatus("Loading latest news...");

  try {
    const response = await fetch(sheetUrl, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Sheet request failed with status ${response.status}.`);
    }

    const csv = await response.text();
    const news = parseSheet(csv);

    if (!news.length) {
      setStatus("No news items are published yet.");
      return;
    }

    news.forEach((item) => newsGrid.append(createNewsCard(item)));
    setStatus("", false);
  } catch (error) {
    console.error(error);
    setStatus("Could not load the news right now. Please check the published Google Sheet link.");
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadNews);
loadNews();
