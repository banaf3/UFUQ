# Anwāʾ general knowledge for the lessons

Prepared 2026-11-05 for the lessons phase, after the second reading pass of the
owner's anwāʾ texts (`docs/ARABIC_SKY_CULTURE.md`). The lessons will first give general
knowledge, such as why al-Jady stays in the north, and only then ask the learner to trace
routes. Each item below records:

- the statement in plain words;
- its sources (Ibn Qutayba by edition paragraph "§", other texts by local line);
- whether it holds everywhere or depends on the observer's place;
- the lesson use.

All items are **proposals for educational and cultural review**. None is a lesson yet.
Numbers marked *computed* come from a UFUQ calculation and are display-level estimates,
not validated ScientificProfileV1 values. The route relationships are in
`anwa-navigation-relationships.md`.

## 1. The pole and al-Jady

| ID | Statement | Sources | Place dependence | Lesson use |
| --- | --- | --- | --- | --- |
| GK-01 | The whole sky seems to turn once a day around one point, the north celestial pole. Ibn Qutayba says al-Jady is the brightest daughter of the lesser Banāt Naʿsh, "the famous stars nearest the pole". By al-Jady the qibla is known and the way is found, "because it does not move" (*lā yazūl*). | §170 (local text L3100-3103); Muhalhil's verse on al-Jady follows at L3104 | Holds anywhere al-Jady is above the horizon (the northern hemisphere) | Opening idea: one star stays put while the rest turn. |
| GK-02 | Why al-Jady marks north: Earth's axis points almost at it. In 2026 al-Jady is about 0.63° from the pole (*computed*), so it is the best single star for north, but it is not exactly True North. | Computed with Astropy FK5 (IAU 1976 precession) from the local Hipparcos 1997 row of HIP 11767 (RA 37.94614689°, Dec 89.26413805°, proper motion 44.22 and −11.74 mas/yr, parallax 7.56 mas); script in the session scratchpad, to be re-run in the reference tool before any thesis use | Anywhere | Keep **Polaris (al-Jady) and True North as two targets** (CLAUDE.md). The lesson turns from al-Jady to True North with the ProfileV1 geometry. |
| GK-03 | al-Jady was not always this close. It was about 6.9° from the pole around 870 CE, in Ibn Qutayba's lifetime, and 0.74° in 2000. It will come closest, about 0.46°, around 2100 (*computed*). The slow drift is the precession of Earth's axis. | Same computation (870: 6.94°; 1000: 6.21°; 1500: 3.42°; 2000: 0.74°; 2026: 0.63°; 2100: 0.46°) | Anywhere | An "interesting fact" card: the star the Arabs used was a few degrees off the pole, yet still the steadiest guide. |
| GK-04 | How high al-Jady stands equals, very nearly, the observer's latitude. At UMPSA Pekan (geodetic latitude 3.547°, `observer-umpsa-pekan-v1`) it stays between about 2.9° and 4.2° above the northern horizon (latitude ± 0.63°, geometric, no refraction). So it is often hidden by haze, trees or buildings. | Spherical astronomy; latitude from the observer artifact | **Depends on latitude**; invisible south of the equator | Explains why UFUQ teaches helper patterns and True North rather than relying on seeing al-Jady itself at Pekan. |
| GK-05 | Banāt Naʿsh and al-Farqadān circle around al-Jady. Poets paired al-Farqadān with Banāt Naʿsh for finding the way at night. Further north these stars never set; at Pekan they rise and set, so each is up only part of the year or night. | §170 (local text L3124-3128); horizon geometry | **Depends on latitude** | Why there are two routes: the Cassiopeia region (al-Kaff al-Khaḍīb) or greater Banāt Naʿsh, whichever is up (existing route design). |
| GK-06 | Neither Banāt Naʿsh group is a lunar mansion: the moon never meets them and no rain was credited to them. | §170-171 (local text L3107-3108, 3137-3138) | Anywhere | Separates the guidance stars from the anwāʾ (rain) stars. |

## 2. Directions by the stars

| ID | Statement | Sources | Place dependence | Lesson use |
| --- | --- | --- | --- | --- |
| GK-07 | Finding the way by the stars starts from the four horizons. Going north (to Syria), keep al-Jady and Banāt Naʿsh ahead, Suhayl behind and the mansions of the moon on the right. Going south (to Yemen), the reverse. Going east (to Khurāsān), face the mansions, with al-Jady on the left and the two Shiʿrās and Suhayl on the right. Going west, the reverse. | §216 (local text L3707-3713) | The north–south part holds anywhere in the northern tropics; the city names are Iraqi context | First direction lesson: al-Jady = north, Suhayl = south, the mansions run east–west. |
| GK-08 | On a cloudy night, use the winds: the easterly *ṣabā*, the westerly *dabūr*, the southerly *janūb* and the cold northerly *shamāl*. | §217 (local text L3715-3717) | Arabian winds; **regional** | Optional enrichment only; Malaysian winds differ. |
| GK-09 | Suhayl is the red star of the south ("Suhayl of Yemen"). Its dawn rising announced the cool season: "When Suhayl rises, the night grows cool…" | §184-186 (local text L3210-3243) | It stands far higher at Pekan than in Arabia (it is a deep southern star) | South marker; a contrast with al-Jady. |

## 3. The anwāʾ: the moon's mansions and the seasons

| ID | Statement | Sources | Place dependence | Lesson use |
| --- | --- | --- | --- | --- |
| GK-10 | There are 28 lunar mansions. The moon stops at one each night and hides for a night or two at the month's end. The sun stays about 13 days in each mansion and a month in each sign. | §6 (local text L1199-1201); §144-145 (local text L2873-2874) | Anywhere | Why the moon is seen against different stars each night. |
| GK-11 | At any moment 14 mansions are above the horizon and 14 below; when one sets, its *raqīb* (watcher) rises opposite. Ibn Qutayba concludes that we see half of the sky. | §8 (local text L1217-1220) | Anywhere | The horizon cuts the sky in half; a good bridge to the explorer's ground toggle. |
| GK-12 | A *nawʾ* is the setting of one mansion in the west at dawn while its opposite rises in the east. A new one comes every 13 days (14 for al-Jabha), and the 28 fill the year. The Arabs said every star brings rain, wind, cold or heat. A *nawʾ* that passed with no rain was said to have "failed" (*khawā*). | §9 (local text L1224-1227) | Dawn dates shift with latitude and era | Core definition of the anwāʾ. |
| GK-13 | People disagreed whether the *nawʾ* belongs to the setting star or to the rising one. | §10 (local text L1228-1229) | Anywhere | Shows a living tradition with debate. |
| GK-14 | Fourteen mansions are northern (*shaʾmiya*), from al-Sharaṭān to al-Simāk al-Aʿzal, and fourteen southern (*yamāniya*), from al-Ghafr to al-Rishāʾ. The rising point of al-Simāk al-Aʿzal divides northern from southern stars. | §8 (local text L1221-1222); §77 (local text L1997-1999) | The order of rising points holds at any latitude; the azimuths themselves change | Rising azimuth as a direction idea. |

## 4. The qibla

| ID | Statement | Sources | Place dependence | Lesson use |
| --- | --- | --- | --- | --- |
| GK-15 | Historical qibla rules were tied to place. From Iraq: keep al-Jady against the right shoulder or the back of the neck. When al-Qurḥa rises, you face the qibla of al-Kūfa. Ibn Kunāsa counted seven mansions from the one setting at dawn. | §218 (local text L3718-3719); §174 (local text L3152-3154); §219 (local text L3720 onwards) | **Iraq only**; not valid for Pekan | Teach that the star–qibla relation depends on place. Then use the computed Pekan bearing from True North (KC-05, after the Qibla geodesy decisions). Never state a Pekan bearing from these rules. |

## 5. Stories for engagement (already on the explorer cards)

All are paraphrased with references on the cards.

- Banāt Naʿsh, the daughters walking with the bier, and al-Suhā, the eyesight test (§171).
- The two Shiʿrās and Suhayl: al-ʿAbūr crossed the Milky Way after Suhayl, and al-Ghumayṣāʾ stayed behind and wept until her eyes grew bleary (§57).
- Ḥaḍār and al-Wazn, the two stars that make people swear they have seen Suhayl (§187; Ibn ʿĀṣim L3580-3584).
- The landing and flying eagles; the five horsemen with al-Ridf behind them (§181-182).
- al-Kaff al-Khaḍīb, al-Thurayyā's henna-dyed hand, which is also the she-camel's hump (§40-41).

**Not yet sourced for lessons:** the compilation's story that al-Jady killed Naʿsh, and
that his daughters circle the sky seeking revenge. The owner's three primary texts were
searched and do not contain it. It needs a primary source before any lesson uses it.

## 6. Readiness of the route stars

These are the stars and figures the routes and lessons rely on. Every name was read in a
primary text. The status is that of the curation record; review is still required.

| Star or figure | Evidence | Note |
| --- | --- | --- |
| al-Jady (HIP 11767) | PRIMARY_TEXT_READ (§170, §216, §218) | Polaris; distinct from True North |
| al-Farqadān (HIP 72607, 75097) | figure read (§170); stars NAMED_WITH_FIGURE | Lesser Banāt Naʿsh |
| Greater Banāt Naʿsh and its daughters | PRIMARY_TEXT_READ (§171) | Alternative route |
| al-Muqaddamān (α, β UMa) | SCHOLARLY_STUDY (Kunitzsch no. 176: the sailors Ibn Mājid and al-Mahrī) | The front bier stars; the modern "pointer" rule is not in the anwāʾ texts |
| al-Kaff al-Khaḍīb | PRIMARY_TEXT_READ (§40-41) | Cassiopeia-region helper |
| al-Abyaḍ, al-Qurḥa, al-Shāʾ, al-Rāʿī | PRIMARY_TEXT_READ (§174-178; Ibn ʿĀṣim L4602-4612) | Cited steps towards al-Jady |
| Kawkabā al-Firq / al-Qarn | figure read (al-Marzūqī L23674); al-Qarn = al-Firq is a UFUQ reading for review | Ibn ʿĀṣim: a spear's length from al-Jady |
| al-Athāfī | PRIMARY_TEXT_READ (Ibn ʿĀṣim L4605: between al-Qidr and al-Jady) | Draco step |
| Suhayl (HIP 30438) | PRIMARY_TEXT_READ (§184-187, §216) | South marker |
