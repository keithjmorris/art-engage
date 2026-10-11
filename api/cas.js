// Looks up one artwork in the Contemporary Art Society online catalogue.
// Used only by the admin page when an artwork is added or refreshed,
// so the catalogue receives one small request per artwork, never one per visitor.
//
//   GET /api/cas?nid=8076

const { ARTWORK_INCLUDES, asArray, casFetch, parseArtwork } = require("./_cas");

module.exports = async (req, res) => {
  const nid = String((req.query && req.query.nid) || "").trim();
  if (!/^\d{1,7}$/.test(nid)) {
    return res.status(400).json({ error: "Please enter a catalogue number (digits only)." });
  }

  let json;
  try {
    json = await casFetch(`/jsonapi/node/object_artwork?filter[drupal_internal__nid]=${nid}&include=${ARTWORK_INCLUDES}`);
  } catch (err) {
    return res.status(502).json({ error: "Couldn't reach the catalogue. Please try again shortly." });
  }

  const node = asArray(json.data)[0];
  if (!node) {
    return res.status(404).json({ error: `No artwork found with catalogue number ${nid}.` });
  }

  const art = parseArtwork(node, json.included);
  art.catalogueId = nid;

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json(art);
};
