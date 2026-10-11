// Lists the works held by one museum, 25 at a time.
// The admin page asks for one page after another, so even a large museum
// never causes a long-running request on our side or a burst on the catalogue.
//
//   GET /api/cas-museum-works?museum=<museum id>&offset=0

const { ARTWORK_INCLUDES, asArray, casFetch, parseArtwork } = require("./_cas");

const PAGE = 25;

module.exports = async (req, res) => {
  const museum = String((req.query && req.query.museum) || "").trim();
  const offset = Math.max(0, parseInt((req.query && req.query.offset) || "0", 10) || 0);
  if (!/^[0-9a-f-]{36}$/i.test(museum)) {
    return res.status(400).json({ error: "Missing or invalid museum." });
  }

  let json;
  try {
    json = await casFetch(
      "/jsonapi/node/object_artwork" +
        "?filter[field_related_museums.id]=" + museum +
        "&include=" + ARTWORK_INCLUDES +
        "&sort=drupal_internal__nid" +
        "&page[limit]=" + PAGE + "&page[offset]=" + offset
    );
  } catch (err) {
    return res.status(502).json({ error: "Couldn't reach the catalogue. Please try again shortly." });
  }

  const works = asArray(json.data).map((node) => parseArtwork(node, json.included));
  const hasMore = !!(json.links && json.links.next);

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).json({ works, nextOffset: hasMore ? offset + PAGE : null });
};
