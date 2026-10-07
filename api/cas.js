// Looks up one artwork in the Contemporary Art Society online catalogue.
// Used only by the admin page when an artwork is added or refreshed,
// so the catalogue receives one small request per artwork, never one per visitor.
//
//   GET /api/cas?nid=8076

const CAS = "https://contemporaryartsociety.org";

const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

module.exports = async (req, res) => {
  const nid = String((req.query && req.query.nid) || "").trim();
  if (!/^\d{1,7}$/.test(nid)) {
    return res.status(400).json({ error: "Please enter a catalogue number (digits only)." });
  }

  const url =
    `${CAS}/jsonapi/node/object_artwork?filter[drupal_internal__nid]=${nid}` +
    `&include=field_related_artists,field_related_museums,field_year_created_term,field_object_image.field_media_image_4`;

  let json;
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/vnd.api+json",
        "User-Agent": "ArtEngage/1.0 (Contemporary Art Society visitor responses)"
      }
    });
    if (!r.ok) throw new Error("Catalogue replied " + r.status);
    json = await r.json();
  } catch (err) {
    return res.status(502).json({ error: "Couldn't reach the catalogue. Please try again shortly." });
  }

  const node = asArray(json.data)[0];
  if (!node) {
    return res.status(404).json({ error: `No artwork found with catalogue number ${nid}.` });
  }

  const included = asArray(json.included);
  const find = (ref) => included.find((i) => ref && i.type === ref.type && i.id === ref.id);
  const rel = (name) => asArray(node.relationships && node.relationships[name] && node.relationships[name].data);
  const a = node.attributes || {};

  const artists = rel("field_related_artists").map(find).filter(Boolean).map((i) => i.attributes.title);
  const museums = rel("field_related_museums").map(find).filter(Boolean).map((i) => i.attributes.title);
  const yearTerm = find(rel("field_year_created_term")[0]);
  const year = yearTerm ? yearTerm.attributes.name : "";

  // Image: artwork → media item → file
  let imageUrl = "";
  let imageAlt = "";
  const media = find(rel("field_object_image")[0]);
  if (media) {
    const fileRef = asArray(media.relationships && media.relationships.field_media_image_4 && media.relationships.field_media_image_4.data)[0];
    const file = find(fileRef);
    const path = file && file.attributes && file.attributes.uri && file.attributes.uri.url;
    if (path) imageUrl = path.startsWith("http") ? path : CAS + path;
    imageAlt = (fileRef && fileRef.meta && fileRef.meta.alt) || "";
  }

  // Catalogue titles end with the year, e.g. "Pope I (1951)". The year is shown separately.
  let title = a.title || "";
  if (year) title = title.replace(new RegExp("\\s*\\(" + year.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\)\\s*$"), "");

  const alias = a.path && a.path.alias;

  res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  return res.status(200).json({
    catalogueId: nid,
    title,
    artist: artists.join(", "),
    year,
    museum: museums.join("; "),
    accessionNumber: a.field_accession_number || "",
    medium: a.field_medium_and_support || "",
    imageUrl,
    imageAlt,
    moreInfoUrl: alias ? CAS + alias : `${CAS}/node/${nid}`
  });
};
