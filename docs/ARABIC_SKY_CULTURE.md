# Arabic sky culture (anwāʾ) in the sky explorer

Owner requests of 2026-11-05. The explorer teaches the Arabic sky of the anwāʾ, not the
IAU constellations (IMP-021). After the owner's review of the first version, the figures
use the compilation's own lines and the cards were rewritten for learners (IMP-022). This
document records:

- what the explorer shows;
- where each name, line and card text comes from;
- how the curation was built and how to extend it;
- what still needs review.

The material kept for the lessons is in two places:

- `docs/references/syntheses/anwa-navigation-relationships.md`: links from one figure to
  another, for routes;
- `docs/references/syntheses/anwa-general-knowledge.md`: general knowledge, such as why
  al-Jady stays in the north.

## What the explorer shows

| Element | Behaviour |
| --- | --- |
| Figures | 114 drawn figures from the anwāʾ tradition: the 28 lunar mansions, the lion, al-Jawzāʾ, Banāt Naʿsh, the she-camel, the hands of al-Thurayyā, and others. Two single-star entries (al-Simāk al-Aʿzal, ʿAnāq al-Arḍ) are star names, not drawn figures. |
| Figure lines | The compilation's lines, unchanged (582 segments). Blue, fainter than the stars, and stopping short of each star by its drawn size. Herds and areas of stars (gazelles, hyenas, sheep, oryxes, horses and so on) are dashed and fainter. A selected figure, its larger figure and its parts are drawn brighter. al-Thurayyā has no lines, as in the compilation (it marks the cluster only). |
| Labels | Arabic in Tajawal with the plain-letter transliteration under it (for example الجدي / Al-Jady), at one weight, never a translation. Figure names are blue and centred in the middle of the figure's stars, as in Stellarium. When that middle is nearer another figure's lines (al-Thurayyā al-Ṣūra's lies in al-Ḥamal), the name sits on the figure's own lines. When its place is taken, a name moves across or beside it, or along the lines (IMP-022). In wide views only the guidance figures (those in a cited navigation relationship) and the brightest figures are named. The others appear as the view narrows. al-Jady, the star the guidance leads to (`guidanceTarget`), is named in bold, in every view. Smaller figures inside a larger one, such as the lion's mansions, are named at the star-name size in a slightly darker blue, when the field of view is 100° or less. Pair or group names (al-Farqadān, al-Fawāris) and stars named after their own figure are named once, by the figure label. Fainter star names appear as the view narrows. |
| Stars without an Arabic name | Unlabelled. Clicking one shows its modern name or catalogue number. |
| Star card | The name in English letters, with the Arabic script under it; other names; and a short paragraph of interesting facts from the sources in UFUQ's own words. Then the figures it belongs to (clickable), the modern IAU name with its origin (collapsible), its catalogue number and brightness, and the References, shown when opened. |
| Figure card | Opened by clicking a figure label, a "Part of" link or a search result. It shows the names (English letters first), the paragraph, its larger and smaller figures, its stars and the References (shown when opened). |
| Card links | A figure or star clicked inside a card is selected, and the view turns and zooms to it: a star to a 30° field at most, a figure so that it fills about 70% of the view. "← Back" returns to the previous card and to that card's view, one step at a time. Picking on the sky or searching starts a new trail. |
| Search | By plain transliteration (hyphens, apostrophes and accents optional), Arabic script (vowel marks optional) or a star's modern name. A target below the horizon is reported, not shown underground. |
| Not shown to learners | Evidence states, recorded conflicts, "not recorded" messages, altitude and azimuth, and descriptions of where a star lies relative to others or that hold only in one region. They stay in the curation and the API for reviewers and lessons. |

Contract: `sky.v2` (`packages/contracts/src/sky.ts`), with the additive fields `about` and
`references` on figures and Arabic names.

## Sources and how each is used

| Source | Role | Limits |
| --- | --- | --- |
| Stellarium *Arabic (Ancient)* by Khalid al-Ajaji (`STELLARIUM-ARABIC-ANCIENT`, pinned commit `014fbb5e`, CC BY-ND 4.0) | The owner's main navigation compilation: candidate names, star memberships and the figure lines. | Lines are reproduced unmodified with attribution; UFUQ never edits them (ND). Its English glosses are used only as facts in UFUQ's own words, cited; its descriptions are not copied. |
| Ibn Qutayba, *Kitāb al-Anwāʾ* (`IBN-QUTAYBA-ANWA`) | The primary anwāʾ text. Cards cite the edition paragraph (§) printed in the local Shamela text; reviewer notes add the local line. | The local text is a Shamela derivative of an unverified edition; check § and wording against the 1956 Hyderabad print. |
| al-Marzūqī, *al-Azmina wa-l-Amkina* (`AL-MARZUQI-AZMINA`) | Later compilation with parallel star sections. | Noisy OCR; locators are local text lines. |
| Ibn ʿĀṣim, *al-Anwāʾ wa-l-Azmina* (`IBN-ASIM-ANWA`) | Andalusi compilation: al-Thurayyā's arm, the northern stars near al-Jady, al-Nasaqān, Ḥaḍār and al-Wazn. | Noisy OCR; regional context differs. |
| Hafez 2010, Table 2 (`HAFEZ-2010`) | al-Ṣūfī crosswalk; the seven Pleiades stars of al-Thurayyā. | Thesis table, with some misprints. |
| Kunitzsch 1961 (`KUNITZSCH-1961`) | Readings and the sea pilots' names: al-Muqaddamān (no. 176), al-Maʿqil (no. 178), al-Faqarāt (nos 99a-b), al-Tābiʿ (no. 292). | OCR; check page images. |
| IAU WGSN (`IAU-WGSN-CSN`) | Cross-check of identifications, and the origin of modern names (Betelgeuse, Deneb, Alioth). | A modern naming authority, not an anwāʾ source. |

## Evidence states

Every name and figure carries one state, for reviewers and for choosing lesson content.
It is not shown on the cards.

| State | Meaning | Figures | Stars |
| --- | --- | --- | --- |
| `PRIMARY_TEXT_READ` | The passage was read in a primary text and is cited. | 101 | 70 |
| `PRIMARY_TEXT_POINTER` | Found by search only, not yet read. | 0 | 0 |
| `COLLECTIVE_NAME_IN_PRIMARY_TEXT` | The texts name the group; the exact name or division is the compilation's (the three separate leaps, the front and rear chair of al-Jawzāʾ). | 10 | 1 |
| `NAMED_WITH_FIGURE` | The star carries the name of its figure, and that figure was read. | 0 | 36 |
| `SCHOLARLY_STUDY` | Named in a modern study that cites historical sources (Kunitzsch: the sea pilots Ibn Mājid and Sulaymān al-Mahrī). | 0 | 3 |
| `COMPILATION_ONLY` | Not yet found in the owner's texts. | 5 | 13 |

The remaining compilation-only records are:

- the figures al-Fāriṭān, Yadā al-Nāqa, al-Aybasān, al-Aghriba and Udḥī al-Naʿām wa-l-Bayḍ
  wa-l-Qayḍ;
- the stars al-Aybasān (2), the maritime Suhayl names (Suhayl Ḥaḍār, Suhayl al-Wazn,
  Suhayl Raqāsh), al-Fāriṭān (2), al-Aʿrajān (2), ʿAdhabat al-Rumḥ (2), al-Rāqiṣ and
  al-Tābiʿ.

al-Tābiʿ is, in the texts, a name of al-Dabarān (Kunitzsch no. 292); the card says so.

## Recorded identification conflicts

The compilation's identification is drawn in each case. Where a disagreement is
interesting to a learner, the card says so in plain words, for example "Early writers
disagree on which forearm holds al-Shiʿrā al-Ghumayṣāʾ." The full record is in the
curation's `conflicts` and needs a named reviewer's decision.

- **al-Ṭarf:** the compilation draws ε, ο Leo. IAU WGSN (Kunitzsch) gives κ Cnc and
  λ Leo; Hafez gives χ Cnc and λ Leo.
- **al-Dhirāʿ al-Maqbūḍa / al-Mabsūṭa:** Ibn Qutayba §57, §63 and §97 put al-Ghumayṣāʾ and
  its Mirzam (α, β CMi) in the extended forearm. The compilation and al-Marzūqī put
  al-Ghumayṣāʾ in the retracted one.
- **al-Zirr / al-Maysān:** the compilation gives γ Gem and ξ Gem. IAU WGSN gives
  Alzirr = ξ Gem.
- **Ḥaḍār / al-Wazn:** the compilation gives α Phe and α Eri. IAU WGSN gives Hadar = β Cen
  and Wazn = β Col.
- **Kabid al-Asad:** Ibn Qutayba calls it a red star; the compilation's α² CVn is white.
- **al-Nājidh:** the compilation gives γ Ori. al-Marzūqī equates al-Nājidh with Rijl
  al-Jawzāʾ (β Ori).
- **Readings:**
  - al-Jawn, against a local OCR reading al-Jawzāʾ (§171);
  - al-Ashfār (Ibn ʿĀṣim), against Ibn Qutayba's al-Ashʿār;
  - al-Laʿṭ, against al-Jawāzī;
  - al-Yamāmatān (al-Marzūqī), against al-Yamāniyān (Ibn Qutayba, Ibn ʿĀṣim).
- **Other variants:** the number of stars in the gazelles' leaps; Ibn ʿĀṣim's reading of
  al-Kaff al-Khaḍīb as faint stars.

## Names and transliteration

- **Arabic script:** the attested form. Where the compilation's form is not in the
  primary texts but Ibn Qutayba gives one for the same stars, the explorer shows Ibn
  Qutayba's form and keeps the compilation's as another name. Examples: al-Shiʿrā al-ʿAbūr
  for Sirius, al-Shiʿrā al-Ghumayṣāʾ for Procyon, al-Fakka, al-ʿAwwāʾ and Banāt Naʿsh
  al-Kubrā.
- **Curated transliteration:** IJMES, UFUQ house style. The article is al- everywhere, ʿ
  marks ʿayn and ʾ marks hamza, macrons and dots are used, tāʾ marbūṭa is -a, and names
  are never translated.
- **Shown transliteration (`UFUQ_PLAIN_V1`):** generated from the IJMES form for general
  readers:
  - macrons and dots are dropped;
  - ʿ becomes an apostrophe between two letters and is dropped at a word edge;
  - ʾ is dropped;
  - the first letter is capitalized.

  Examples: Banāt Naʿsh al-Kubrā → Banat Na'sh al-Kubra; al-Shiʿrā al-ʿAbūr →
  Al-Shi'ra al-Abur; al-Jawzāʾ → Al-Jawza. Card text follows the same spelling.
- **Vocalization:** from vocalized source forms and IAU WGSN/Kunitzsch spellings. Records
  marked `UNVERIFIED` (al-Hulba, al-Laʿṭ, al-Maʿqil) need a philologist.

## Figure lines (`COMPILATION_LINES_UNMODIFIED`)

The anwāʾ texts describe groups and shapes, not drawn lines. Khalid al-Ajaji drew lines
for each figure in the compilation, and UFUQ shows those lines exactly.

1. Each figure's `lines` arrays are copied verbatim from the pinned compilation into the
   curation. All 116 were checked identical to the pinned copy.
2. Each polyline is read as its consecutive pairs. A pair of the same star is a one-star
   marker and draws nothing, and a repeated pair is drawn once.
3. A pair with a star outside the display field (V > 6.5) is not drawn and is recorded in
   `omittedSegmentsNotInField`. Only al-Qidr is affected: three segments through HIP
   102727 and 102775, so its ring shows a gap. Adding those two stars needs a new
   Hipparcos acquisition. Changing the ring would be an adaptation.
4. UFUQ adds no segment of its own. Lesson guide lines from one figure to another remain
   `MODERN_PEDAGOGICAL` and belong to the lessons, not the explorer.

The licence basis and the drawing style are in IMP-022. The code is `lineSegments` in
`tools/catalogue/src/generate/arabic-sky.ts`, tested in
`tools/catalogue/tests/arabic-sky.test.ts`.

## How it was built (and how to extend it)

1. **Candidates.** The compilation's 116 figures and 123 star names were joined to BSC
   Bayer/Flamsteed designations (by HD number) for review.
2. **Attestation.** Each name was searched in the four local Arabic texts. Hit counts and
   first lines are kept as `attestation` pointers.
3. **First reading.** Ibn Qutayba §22–§98 (the mansions), §170–§187 (the famous stars and
   Suhayl) and §213–§219 (guidance and qibla), with parallel passages in al-Marzūqī and Ibn
   ʿĀṣim.
4. **Second reading (for the cards and the lessons).**
   - Ibn Qutayba §6–§10 (the mansions and the meaning of *nawʾ*), §48 and §97 (where the
     moon stops when it misses a mansion), §57 (the two Shiʿrās) and §85 (the southern
     birds and ostriches).
   - Ibn ʿĀṣim's northern stars near al-Jady (L4600-4612), al-Rawḍa (L4640-4646),
     al-Thurayyā's arm (L3020-3034) and Ḥaḍār and al-Wazn (L3576-3586).
   - al-Marzūqī's arm and al-Nāqa passages.
   - Kunitzsch's entries for the sea pilots' names.

   This confirmed 34 of the 52 compilation-only names and closed every search-only record.
5. **Cards.** Each `about` paragraph combines the cited sources in UFUQ's own words. It
   leaves out where a star lies and anything true only in one region, and lists its
   sources in `aboutSources`. Generation rejects card text that is not plain ASCII or has
   no source.
6. **Curation.** The tracked, human-curated record is
   `data/curation/sky-culture/arabic-anwa.v1.json` (schemaVersion 2). It is built by
   private authoring scripts in
   `local-reference/cultural-astronomy/derived/research-notes/anwa-authoring-2026-11-05/`
   (`about-anwa.mjs`, `apply-about-and-lines.mjs`). `npm run data:generate` then builds
   `sky-culture-arabic-anwa-v1` (artifact version 2) and the synthetic
   `synthetic-arabic-sky-culture-v1`.

**To add or correct a record,** edit the curation with a cited source, regenerate, then
run `npm run check` and `npm run test`. Never add a name, membership, identification or
card fact without a source. Never edit the compilation's lines.

Names attested in Ibn Qutayba but not yet identified with stars stay out of the data
until an identification source is found:

- al-Ḥayya (between al-Farqadān and Banāt Naʿsh; its head is like an anklet ring, Ibn
  ʿĀṣim);
- ʿArsh al-Simāk, al-Qubba, al-Safīna and the two Ḍifdaʿs as separate figures;
- Tāj al-Jawzāʾ, Raʾs al-Thawr, al-ʿUnuq;
- Qadamā Suhayl, al-Aʿbār, al-Furūd and Balqayn as separate stars;
- al-Samaka al-Ṣughrā (the small fish) and Sahm al-Rāmī (the archer's arrow).

al-Qarn is probably the compilation's Kawkabā al-Firq: Ibn ʿĀṣim's al-Qarn and
al-Marzūqī's al-Firq have the same description, with al-Qurḥa below. This is a UFUQ
reading, recorded as relationship `anwa-rel-qarn-jady-ibn-asim`, for review.

## Further sources worth acquiring

The anwāʾ literature draws on several kinds of source. Ibn Qutayba himself quotes these:

- pre-Islamic and early Islamic poetry (Dhū al-Rumma, al-Akhṭal, Ḥātim al-Ṭāʾī,
  al-Kumayt, Muhalhil);
- the rhymed sayings of the Arabs (sajʿ);
- Bedouin informants (Abū Ziyād al-Kilābī);
- earlier, mostly lost, anwāʾ books (Ibn Kunāsa, al-Naḍr b. Shumayl, Abū Ḥanīfa
  al-Dīnawarī);
- the Qurʾān and ḥadīth (al-Shiʿrā, al-Mijdaḥ).

Later compilers carried this material on. The following would strengthen identifications
and close the remaining compilation-only records. Bibliographic details are from standard
references; check the exact edition before purchase.

- **al-Bīrūnī, *al-Āthār al-bāqiya*** (ed. C. E. Sachau, Leipzig 1878), and its English
  translation *The Chronology of Ancient Nations* (Sachau, London 1879). Public domain.
  It has a full chapter on the lunar mansions and the anwāʾ.
- **al-Ṣūfī, *Ṣuwar al-kawākib*** (Hyderabad, Dāʾirat al-Maʿārif al-ʿUthmāniyya, 1954).
  Schjellerup's French translation, *Description des étoiles fixes* (St Petersburg, 1874),
  is public domain. al-Ṣūfī matches the Arab names to Ptolemaic stars. The compilation
  also cites Khalid al-Ajaji's 2021 digital critical edition.
- **Ibn Sīda, *al-Mukhaṣṣaṣ*** (Būlāq). Public domain. Its anwāʾ and stars chapters gather
  the lexicographers' reports.
- **Ibn al-Ajdābī, *al-Azmina wa-l-Anwāʾ*** (ed. ʿIzzat Ḥasan, Damascus 1964).
- **Ibn Mājid and Sulaymān al-Mahrī** (Ferrand, *Instructions nautiques*, 1921–1928,
  public domain; G. R. Tibbetts, *Arab Navigation in the Indian Ocean before the Coming of
  the Portuguese*, 1971). These are the sources of the maritime names (al-Muqaddamān,
  al-Maʿqil, the Suhayl names). Keep them in a separate maritime layer.
- **P. Kunitzsch and T. Smart, *A Dictionary of Modern Star Names*** (Sky Publishing,
  2006), and Kunitzsch, "al-Manāzil", *Encyclopaedia of Islam*, 2nd ed. These give
  identification arguments.
- **D. M. Varisco, "The Origin of the anwāʾ in Arab Tradition"**, *Studia Islamica* 74
  (1991). The scholarly frame for the genre.

## Review gate

`sky-culture-arabic-anwa-v1` and its curation are `REVIEW_REQUIRED`. The strict
`SCIENTIFIC_PROFILE_V1` scope shows no Arabic culture until a named reviewer approves the
artifact (`data/approvals/README.md`). The opt-in `REVIEW_PREVIEW` scope shows it,
labelled unreviewed.

The review covers:

- Arabic forms and both transliterations;
- each identification, especially the conflicts above;
- every card paragraph and reviewer note, against the print editions;
- the use of the compilation's memberships and lines under its licence (IMP-022).
