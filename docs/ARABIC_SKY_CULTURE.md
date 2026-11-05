# Arabic sky culture (anwāʾ) in the sky explorer

Owner request, 2026-11-05. The explorer teaches the Arabic sky of the anwāʾ, not the IAU
constellations. This document records:

- what the explorer shows;
- where each name, note and figure comes from;
- how the curation was built and how to extend it;
- what still needs review.

The navigation relationships found along the way are kept for the tutorial lessons in
`docs/references/syntheses/anwa-navigation-relationships.md`.

## What the explorer shows

| Element | Behaviour |
| --- | --- |
| Figures | 114 drawn figures from the anwāʾ tradition: the 28 lunar mansions, the lion, al-Jawzāʾ, Banāt Naʿsh, the she-camel, the hands of al-Thurayyā, and others. Two single-star entries (al-Simāk al-Aʿzal, ʿAnāq al-Arḍ) are star names, not drawn figures. |
| Figure lines | UFUQ teaching lines (`UFUQ_TREE_V1`, `MODERN_PEDAGOGICAL`). Herds and areas of stars (`GROUP`: gazelles, hyenas, sheep, oryxes, horses, and so on) are dashed and faint. A selected figure, its larger figure and its parts are highlighted. |
| Figure labels | Arabic script with the IJMES transliteration under it, never a translation. Smaller figures inside a larger one, such as the lion's mansions, are named when the field of view is 100° or less. |
| Star labels | Only Arabic names of the tradition, in Arabic with the transliteration under it. Pair or group names (al-Farqadān, al-Fawāris) and stars named after their own figure are named once, by the figure label. Fainter names appear as the view narrows, as before. |
| Stars without an Arabic name | Unlabelled. Clicking one shows its modern IAU name (or HIP number) and says that no anwāʾ name is recorded. |
| Star card | Arabic name and transliteration; alternative names; notes from the anwāʾ texts with citations; disputed or uncertain points; the evidence state; the figures it belongs to (clickable). Below these come the modern IAU WGSN name and etymology ("origin"), then the catalogue facts. No IAU constellation is listed. |
| Figure card | Opened by clicking a figure label, a "Part of" link or a search result. It shows the names, notes, disputes and evidence; its larger and smaller figures; its stars with their Arabic names; and the sources. |
| Search | By transliteration, Arabic script or a star's modern name. A target below the horizon is reported, not shown underground. |
| Removed | The IAU constellation figures and names, and the culture selector. The `sky-culture-iau-v1` artifact is kept only for modern star names (origin information). |

Contract: `sky.v2` (`packages/contracts/src/sky.ts`) replaces `sky.v1`. It has one
`culture`, `arabicNames` and `modernNames`, instead of a list of `cultures` and
`starNames`.

## Sources and how each is used

| Source | Role | Limits |
| --- | --- | --- |
| Stellarium *Arabic (Ancient)* compilation by Khalid al-Ajaji (`STELLARIUM-ARABIC-ANCIENT`, pinned commit `014fbb5e`, CC BY-ND 4.0) | The owner's main navigation compilation: candidate names and star memberships, cited per record. | Its line arrays are never used (ND). Its English glosses and descriptions are not copied. |
| Ibn Qutayba, *Kitāb al-Anwāʾ* (`IBN-QUTAYBA-ANWA`) | The primary anwāʾ text. Notes cite the edition paragraph number (§) printed in the local Shamela text, plus the local line. | The local text is a Shamela derivative of an unverified edition; check § and wording against the 1956 Hyderabad print. |
| al-Marzūqī, *al-Azmina wa-l-Amkina* (`AL-MARZUQI-AZMINA`) | Later compilation, parallel star sections; several notes and conflicts. | Noisy OCR; locators are local text lines. |
| Ibn ʿĀṣim, *al-Anwāʾ wa-l-Azmina* (`IBN-ASIM-ANWA`) | Andalusi compilation; notes on the hands of al-Thurayyā, al-Nasaqān and Ḥaḍār/al-Wazn. | Noisy OCR; regional context differs. |
| Hafez 2010, Table 2 (`HAFEZ-2010`) | al-Ṣūfī crosswalk; the seven Pleiades stars of al-Thurayyā (the compilation draws only a marker there). | Thesis table, with some misprints (see conflicts). |
| Kunitzsch 1961 (`KUNITZSCH-1961`) | Readings (al-Jady / al-Judayy). | OCR; check page images. |
| IAU WGSN (`IAU-WGSN-CSN`) | Independent cross-check of identifications; its etymologies follow Kunitzsch and Smart. | A modern naming authority, not an anwāʾ source. |

## Evidence states

Every name and figure carries one state. The card explains it in words.

| State | Meaning | Count |
| --- | --- | --- |
| `PRIMARY_TEXT_READ` | The passage was read in a primary text and is cited in a note or conflict. | 143 |
| `PRIMARY_TEXT_POINTER` | The name was found in a primary text by search, but the passage is not yet read. | 27 |
| `COLLECTIVE_NAME_IN_PRIMARY_TEXT` | The texts name the group; the exact name or division is the compilation's (for example the three separate "leaps", or the front and rear chair of al-Jawzāʾ). | 10 |
| `NAMED_WITH_FIGURE` | The star is named after its figure, and the texts describe that figure. | 7 |
| `COMPILATION_ONLY` | Not yet located in the owner's primary texts. These include the maritime Suhayl names (Suhayl Ḥaḍār, Suhayl al-Wazn, Suhayl Raqāsh), which the compilation draws from Ibn Mājid, and a few southern groups. | 52 |

Counts are for the 239 curated records: 116 figures and 123 stars.

## Recorded identification conflicts

These are shown to the user as "Disputed or uncertain" and need a named reviewer's
decision. The compilation's identification is drawn in each case.

- **al-Ṭarf:** the compilation draws ε, ο Leo. IAU WGSN (Kunitzsch) gives κ Cnc and
  λ Leo; Hafez gives χ Cnc and λ Leo.
- **al-Dhirāʿ al-Maqbūḍa / al-Mabsūṭa:** Ibn Qutayba §57 and §63 put al-Ghumayṣāʾ (α CMi)
  in the extended forearm. The compilation and al-Marzūqī put it in the retracted one.
- **al-Zirr / al-Maysān:** the compilation gives γ Gem and ξ Gem. IAU WGSN gives
  Alzirr = ξ Gem.
- **Ḥaḍār / al-Wazn:** the compilation gives α Phe and α Eri. IAU WGSN gives Hadar = β Cen
  and Wazn = β Col.
- **Kabid al-Asad:** Ibn Qutayba calls it a red star; the compilation's α² CVn is white.
- **al-Nājidh:** the compilation gives γ Ori. al-Marzūqī equates al-Nājidh with Rijl
  al-Jawzāʾ (β Ori).
- **Other readings:** al-Jawn vs a local OCR reading al-Jawzāʾ (§171); al-Ashfār vs
  Ibn Qutayba's al-Ashʿār; al-Laʿṭ vs al-Jawāzī.
- **Other variants:** the number of stars in the gazelles' leaps; Ibn ʿĀṣim's reading of
  al-Kaff al-Khaḍīb as faint stars.

## Transliteration and Arabic forms

- **Arabic script:** the attested form. Where the compilation's form is not in the
  primary texts but Ibn Qutayba gives one for the same stars, the explorer shows Ibn
  Qutayba's form and keeps the compilation's as an alternative. Examples: al-Shiʿrā
  al-ʿAbūr for Sirius, al-Shiʿrā al-Ghumayṣāʾ for Procyon, al-Fakka, al-ʿAwwāʾ and Banāt
  Naʿsh al-Kubrā.
- **Transliteration:** IJMES (UFUQ house style).
  - The article is written al- everywhere (no sun-letter assimilation).
  - ʿ marks ʿayn and ʾ marks hamza.
  - Macrons mark long vowels and dots mark emphatics.
  - Tāʾ marbūṭa is written -a.
  - Names are never translated.
- **Vocalization:** taken from vocalized source forms and IAU WGSN/Kunitzsch spellings.
  Records marked `UNVERIFIED` (al-Hulba, al-Laʿṭ, al-Maʿqil) need a philologist.

## Figure lines: `UFUQ_TREE_V1`

The anwāʾ texts describe groups and shapes, not drawn lines.

1. UFUQ joins each figure's members by the shortest-separation spanning tree (great-circle
   distance at the catalogue epoch, ties by HIP number).
2. A figure keeps the segments of every smaller figure it contains. The lion therefore
   reuses its mansions, and a selected figure highlights consistently.
3. Figures that the texts describe as a square or ring (`RING`) close their tree when it
   is a simple path. These are al-ʿAwāʾidh, al-Dalw, the two ostrich groups, the chair of
   al-Jawzāʾ, al-Rubaq and the southern tent.

The rule is in `tools/catalogue/src/generate/arabic-sky.ts` and is tested in
`tools/catalogue/tests/arabic-sky.test.ts`. Members fainter than the display field
(V > 6.5) are recorded as `omittedMembersNotInField`. Six stars are affected, in al-Qidr,
al-Nathra, al-Ghafr, al-Asad and al-Haqʿa. Each of these figures keeps at least three
drawn stars.

## How it was built (and how to extend it)

1. **Candidates.** The compilation's 116 figures and 123 star names were joined to BSC
   Bayer/Flamsteed designations (by HD number) for review.
2. **Attestation.** Each name was searched in the four local Arabic texts. Hit counts and
   first lines are kept as `attestation` pointers, but only for names specific enough to
   be meaningful.
3. **Reading.** The following were read in full:
   - Ibn Qutayba §22–§98: the 28 mansions and their attached stars;
   - §170–§187: the famous northern and southern stars, and Suhayl;
   - §213–§219: guidance and qibla.

   Some parallel passages in al-Marzūqī and Ibn ʿĀṣim were also read. Notes are English
   paraphrases with a § and line locator; quotations are not copied.
4. **Cross-checks.** IAU WGSN etymologies (by HIP) and Hafez Table 2 (the mansions).
   Disagreements became recorded conflicts, not silent choices.
5. **Curation.** The result is the tracked, human-curated record
   `data/curation/sky-culture/arabic-anwa.v1.json`, built by a private authoring script.
   The script and the research notes are in `local-reference/cultural-astronomy/derived/`
   (`research-notes/`). `npm run data:generate` then builds
   `sky-culture-arabic-anwa-v1` and the synthetic `synthetic-arabic-sky-culture-v1`.

**To add or correct a record,** edit the curation with a cited source, regenerate, then
run `npm run check` and `npm run test`. Never add a name, membership or identification
without a source. Never import the compilation's line arrays.

Names attested in Ibn Qutayba but not yet identified with stars stay out of the data
until an identification source is found:

- al-Qarn, al-Ḥayya, al-Ḍayqa (as distinct from Kalbā al-Dabarān);
- ʿArsh al-Simāk, al-Qubba, al-Safīna and the two Ḍifdaʿs;
- Tāj al-Jawzāʾ, al-Jawāzī, Raʾs al-Thawr, al-ʿUnuq;
- Qadamā Suhayl, al-Aʿbār, al-Furūd and Balqayn as separate stars;
- al-Ṣalīb as a figure.

## Further sources worth acquiring

The anwāʾ literature draws on several kinds of source. Ibn Qutayba himself quotes these:

- pre-Islamic and early Islamic poetry (Dhū al-Rumma, al-Akhṭal, Ḥātim al-Ṭāʾī,
  al-Kumayt);
- the rhymed sayings of the Arabs (sajʿ);
- Bedouin informants (Abū Ziyād al-Kilābī);
- earlier, mostly lost, anwāʾ books (Ibn Kunāsa, al-Naḍr b. Shumayl, Abū Ḥanīfa
  al-Dīnawarī);
- the Qurʾān and ḥadīth (al-Shiʿrā, al-Mijdaḥ).

Later compilers carried this material on. The following would strengthen identifications
and close the `PRIMARY_TEXT_POINTER` and `COMPILATION_ONLY` records. Bibliographic details
are from standard references; check the exact edition before purchase.

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
  the Portuguese*, 1971). These are the maritime names the compilation uses. Keep them in
  a separate maritime layer.
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

The review covers several things:

- Arabic forms and transliterations;
- each identification, especially the conflicts above;
- the paraphrased notes against the print editions;
- the use of the compilation's memberships under its licence.
