const axios = require("axios");
const cheerio = require("cheerio");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

async function scrapePdfLink(url) {
  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 10000,
    });
    const $ = cheerio.load(response.data);
    let pdfLink = null;

    $("a").each((i, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().toLowerCase();
      if (href.endsWith(".pdf") || text.includes("download") || text.includes("pdf")) {
        pdfLink = href.startsWith("http") ? href : new URL(href, url).href;
        return false;
      }
    });

    return pdfLink;
  } catch {
    return null;
  }
}

exports.handler = async function (event) {
  const query = event.queryStringParameters.q;
  if (!query) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing ?q= parameter" }),
    };
  }

  const searchUrl = `https://www.alevelapi.com/?s=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(searchUrl, {
      headers: { "User-Agent": USER_AGENT },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const items = [];

    const articlePromises = $("article, .post, .search-result, .entry")
      .map((i, el) => {
        const titleEl = $(el).find("h2 a, .entry-title a, h3 a, .post-title a").first();
        const title = titleEl.text().trim();
        const link = titleEl.attr("href");
        if (title && link) {
          return scrapePdfLink(link).then((pdfLink) => ({
            subject: title,
            link,
            pdf_link: pdfLink || null,
          }));
        }
        return null;
      })
      .get();

    const results = await Promise.all(articlePromises);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(results.filter(Boolean), null, 2),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to scrape", details: error.message }),
    };
  }
};
