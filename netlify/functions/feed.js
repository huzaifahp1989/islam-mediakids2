const Parser = require('rss-parser');

const parser = new Parser({ timeout: 10000 });

function stripHtml(s) { return s ? String(s).replace(/<[^>]*>/g, '') : ''; }
function buildExcerpt(item) {
  const text = item.contentSnippet || item.summary || item.content || '';
  const clean = stripHtml(text).trim();
  return clean.length > 180 ? clean.slice(0, 177) + '…' : clean;
}
function extractImage(item) {
  if (item.enclosure && item.enclosure.url) return item.enclosure.url;
  if (item.image && item.image.url) return item.image.url;
  if (item['media:content'] && item['media:content'].url) return item['media:content'].url;
  if (item['media:thumbnail'] && item['media:thumbnail'].url) return item['media:thumbnail'].url;
  const html = item['content:encoded'] || item.content || '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) return match[1];
  return null;
}

exports.handler = async function(event) {
  const limit = (() => {
    const q = event.queryStringParameters || {}; const l = parseInt(q.limit || '4', 10); return isNaN(l) ? 4 : Math.min(Math.max(l, 1), 12);
  })();
  const feedUrl = 'https://imediac.com/feed';
  try {
    const feed = await parser.parseURL(feedUrl);
    const items = (feed.items || []).slice(0, limit).map(item => ({
      title: item.title,
      link: item.link,
      pubDate: item.pubDate || item.isoDate || null,
      image: extractImage(item),
      excerpt: buildExcerpt(item)
    }));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, items, source: feedUrl })
    };
  } catch (error) {
    console.error('Feed function error:', error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Failed to fetch feed' }) };
  }
};
