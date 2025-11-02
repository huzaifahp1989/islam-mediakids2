const express = require('express');
const Router = express.Router();
const Parser = require('rss-parser');

const parser = new Parser({ timeout: 10000 });

// Fetch latest articles from WordPress RSS and return simplified JSON
Router.get('/latest', async (req, res) => {
  const limit = parseInt(req.query.limit || '4', 10);
  const feedUrl = 'https://imediac.com/feed';
  try {
    const feed = await parser.parseURL(feedUrl);
    const items = (feed.items || []).slice(0, limit).map(mapItem);
    res.json({ success: true, items, source: feedUrl });
  } catch (error) {
    console.error('Feed fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feed' });
  }
});

function mapItem(item) {
  const image = extractImage(item);
  const excerpt = buildExcerpt(item);
  return {
    title: item.title,
    link: item.link,
    pubDate: item.pubDate || item.isoDate || null,
    image,
    excerpt
  };
}

function buildExcerpt(item) {
  const text = item.contentSnippet || item.summary || item.content || '';
  const clean = stripHtml(text).trim();
  return clean.length > 180 ? clean.slice(0, 177) + '…' : clean;
}

function stripHtml(s) {
  return s ? String(s).replace(/<[^>]*>/g, '') : '';
}

function extractImage(item) {
  // Common RSS fields
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.image && item.image.url) return item.image.url;
  if (item['media:content'] && item['media:content'].url) return item['media:content'].url;
  if (item['media:thumbnail'] && item['media:thumbnail'].url) return item['media:thumbnail'].url;

  // Parse from content:encoded or content HTML
  const html = item['content:encoded'] || item.content || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) return match[1];

  return null;
}

module.exports = Router;

