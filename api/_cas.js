// Shared helpers for talking to the Contemporary Art Society catalogue.
// (Files starting with "_" in the api folder are not exposed as web addresses by Vercel.)

const CAS = "https://contemporaryartsociety.org";

const ARTWORK_INCLUDES =
  "field_related_artists,field_related_museums,field_year_created_term,field_object_image.field_media_image_4";

const asArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

async function casFetch(path) {
  const r = await fetch(CAS + path, {
    headers: {
      Accept: "application/vnd.api+json",
      "User-Agent": "ArtEngage/1.0 (Contemporary Art Society visitor responses)"
    }
  });
  if (!r.ok) throw new Error("Catalogue replied " + r.status);
  return r.json();
}

// Turn one catalogue artwork record (plus the "included" list) into the fields the app stores
function parseArtwork(node, includedList) {
  const included = asArray(includedList);
  const find = (ref) => included.find((i) => ref && i.type === ref.type && i.id === ref.id);
  const rel = (name) => asArray(node.relationships && node.relationships[name] && node.relationships[name].data);
  const a = node.attributes || {};

  const artists = rel("field_related_artists").map(find).filter(Boolean).map((i) => i.attributes.title);
  const museumNodes = rel("field_related_museums").map(find).filter(Boolean);
  const yearTerm = find(rel("field_year_created_term")[0]);
  const year = yearTerm ? yearTerm.attributes.name : "";

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

  const nid = String(a.drupal_internal__nid || "");
  const alias = a.path && a.path.alias;

  return {
    catalogueId: nid,
    title,
    artist: artists.join(", "),
    year,
    museum: museumNodes.map((m) => m.attributes.title).join("; "),
    museumId: museumNodes.length ? museumNodes[0].id : "",
    accessionNumber: a.field_accession_number || "",
    medium: a.field_medium_and_support || "",
    imageUrl,
    imageAlt,
    moreInfoUrl: alias ? CAS + alias : `${CAS}/node/${nid}`
  };
}

module.exports = { CAS, ARTWORK_INCLUDES, asArray, casFetch, parseArtwork };
