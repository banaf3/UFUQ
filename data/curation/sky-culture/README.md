# Sky-culture curation

`arabic-anwa.v1.json` is the human-curated source record for the sky explorer's Arabic
(anwāʾ) sky culture (`docs/ARABIC_SKY_CULTURE.md`). It holds:

- names, in Arabic script with an IJMES transliteration;
- memberships;
- English paraphrased notes;
- recorded identification conflicts;
- navigation relationships.

Every record cites its sources:

- the owner's navigation compilation (Stellarium *Arabic (Ancient)*, CC BY-ND 4.0), for
  names and memberships only, never its line arrays;
- locators into the owner's primary anwāʾ texts (Ibn Qutayba, al-Marzūqī, Ibn ʿĀṣim);
- the Hafez/al-Ṣūfī crosswalk, Kunitzsch 1961 and IAU WGSN, where used.

`tools/catalogue` turns it into `data/generated/sky-culture-arabic-anwa-v1.json`. Figure
lines are computed there by the `UFUQ_TREE_V1` rule (`MODERN_PEDAGOGICAL`).

Locators point into the local OCR text layers and are not yet verified against print
editions. The whole record is `REVIEW_REQUIRED`. Edit it only with a cited source, never
to make a check pass. Cultural, Arabic-language and identification approval comes only
from a named reviewer (`data/approvals/README.md`).
