// Searches the CAS catalogue for museums by name.
//
//   GET /api/cas-museums?q=peterhead

const { asArray, casFetch } = require("./_cas");

module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || "").trim();
  if (q.length < 3 || q.length > 80) {
    return res.status(400).json({ error: "Please type at least 3 letters of the museum's name." });
  }

  let json;
  try {
    json = await casFetch(
      "/jsonapi/node/museums" +
        "?filter[t][condition][path]=title" +
        "&filter[t][condition][operator]=CONTAINS" +
        "&filter[t][condition][value]=" + encodeURIComponent(q) +
        "&fields[node--museums]=title,drupal_internal__nid" +
        "&sort=title&page[limit]=25"
    );
  } catch (err) {
    return res.status(502).json({ error: "Couldn't reach the catalogue. Please try again shortly." });
  }

  const museums = asArray(json.data).map((m) => ({
    id: m.id,
    nid: String(m.attributes.drupal_internal__nid || ""),
    title: m.attributes.title
  }));

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json({ museums });
};
