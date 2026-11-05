# Anwāʾ navigation relationships (tutorial candidates)

Recorded 2026-11-05 while curating the explorer's Arabic sky culture
(`docs/ARABIC_SKY_CULTURE.md`). These relationships link one star or figure to another
and could teach a learner, step by step, how to reach al-Jady (north) or a direction.
After that, assessments can ask the learner to trace the lines themselves.

The structured records are the `relationships` array in
`data/curation/sky-culture/arabic-anwa.v1.json` (26 records). Every record carries:

- the source locator;
- its context;
- the status `TUTORIAL_CANDIDATE_REVIEW_REQUIRED`.

None of them is a lesson route yet. A lesson uses one only after it becomes a versioned
`GuidanceRelationship` and `LessonRoute` record with its own review (`AGENTS.md`).
Drawing a line between two figures is always `MODERN_PEDAGOGICAL`. The source supports
the relationship; it does not supply a drawn line.

"§" refers to Ibn Qutayba, *Kitāb al-Anwāʾ*: the edition paragraph number printed in the
local text. Locators are unverified against the print edition.

## Routes to al-Jady (north)

| Step | Relationship | Source |
| --- | --- | --- |
| Lesser Banāt Naʿsh | al-Farqadān are the two leading bier stars and al-Jady is the last daughter of the same seven stars. The group leads from the bright pair to al-Jady, which "does not move". | §170 |
| Greater to lesser group | Banāt Naʿsh al-Kubrā lies near the lesser group. The modern "pointer" rule (Merak to Dubhe to Polaris) is not stated in the texts read; using it would be `MODERN_PEDAGOGICAL`. | §171 |
| Cassiopeia region to al-Jady | al-Abyaḍ faces al-Jady about a spear's length away, at the edge of the Milky Way. | §178 |
| | al-Shāʾ (with al-Rāʿī, the brightest) lies between al-Qurḥa and al-Jady. | §175 |
| | al-Qarn, with al-Qurḥa below it, stands beside al-Jady on its eastern side. | §174 |
| | Together these give a cited chain from the al-Kaff al-Khaḍīb / Kawkabā al-Firq region to al-Jady. The current route's helper-to-al-Jady line is `MODERN_PEDAGOGICAL` (`docs/spikes/PHASE1_ROUTE_SCOPE_CASSIOPEIA_ANWA.md`); these stars could become its cited intermediate steps. | |
| Draco route | al-Ḥurrān (al-Dhiʾbān) lie between al-ʿAwāʾidh and al-Farqadān. al-ʿAwāʾidh lie to the left of al-Nasr al-Wāqiʿ, between it and Banāt Naʿsh. This gives a chain: al-Nasr al-Wāqiʿ → al-ʿAwāʾidh → al-Dhiʾbān → al-Farqadān → al-Jady. | §172–173 |
| Between the groups | al-Ḥayya lies between al-Farqadān and Banāt Naʿsh (not yet identified with stars). | §177 |

## Other cited links between figures

| From → to | Relationship | Source |
| --- | --- | --- |
| al-Kaff al-Khaḍīb → al-Ḥūt | It faces al-Ḥūt across the Milky Way. Ibn Kunāsa says the head of al-Ḥūt is "bridled" to it. | §40, §219 |
| al-Dhīkh | A red star between Banāt Naʿsh and al-Nasr al-Wāqiʿ, above al-Ḍibāʿ. | §176 |
| al-Fawāris → al-Nasr al-Wāqiʿ | Behind the eagle, with al-Ridf just behind them. | §182 |
| al-Fakka → al-Simāk al-Rāmiḥ | The ring lies behind al-Simāk al-Rāmiḥ; the two nasaqs start near it. | §179–180 |
| Northern nasaq → al-Nasr al-Wāqiʿ | The northern row ends at the eagle. | al-Marzūqī L23710 |
| Kabid al-Asad | Between al-ʿAwwāʾ and Banāt Naʿsh (identification disputed). | §79 |
| Gazelles' leaps → Banāt Naʿsh | Beneath Banāt Naʿsh when it is high. | §79 |
| al-ʿAyyūq → al-Thurayyā | Rises with it, behind it and nearer the pole; al-Aʿlām follow it. | §42–45 |
| al-Dabarān → al-Thurayyā | Follows it; its name comes from this following. | §46 |
| al-Buṭayn | Between al-Sharaṭān and al-Thurayyā. | §27 |
| al-Ghafr | Between al-Simāk al-Aʿzal and al-Zubānā. | §80 |
| Southern route to Suhayl | al-Jawzāʾ → al-Shiʿrā al-ʿAbūr → al-ʿUdhra (below al-ʿAbūr) → Suhayl (below al-ʿUdhra when it culminates). | §56–62 |

## Direction and qibla rules (historical)

These are historical practice from Iraq or the Ḥijāz. Keep them as historical content.

| Rule | Source | Use in UFUQ |
| --- | --- | --- |
| Travelling north (to Syria): al-Jady and Banāt Naʿsh ahead, Suhayl behind, mansions on the right. To Yemen: the reverse. East: face the mansions, al-Jady on the left, the Shiʿrās and Suhayl on the right. West: the reverse. | §216 | General north/south/east/west logic; valid in principle anywhere north of the equator. Good for a first direction lesson. |
| Qibla from Iraq: al-Jady against the right shoulder or the back of the neck. | §218 | Historical and region-specific. **Not valid for UMPSA Pekan**, where the modern computed qibla points roughly west-north-west. A lesson can teach that the star-to-qibla relation depends on place, then use the computed bearing. |
| "When al-Qurḥa rises, you face the qibla of al-Kūfa." | §174 | Historical, al-Kūfa only. |
| Ibn Kunāsa: when a mansion sets at dawn, the seventh mansion after it marks the qibla; the scorpion breaks the count. | §219 | Historical, Iraq (road to Mecca). |
| Suhayl rises on the left of someone facing the qibla of Iraq. | §184 | Historical, Iraq. |
| The rising point of al-Simāk al-Aʿzal divides the northern (shaʾmiya) and southern (yamāniya) stars. | §77 | Teaches rising azimuths; usable anywhere as a classification idea. |

## Suggested tutorial sequence (proposal, needs educational review)

1. Find al-Jady through the lesser Banāt Naʿsh: al-Farqadān first, then al-Jady (§170).
2. When Banāt Naʿsh is low or below the horizon, as it often is at Pekan (latitude
   3.5° N), use the Cassiopeia region: al-Kaff al-Khaḍīb → al-Abyaḍ / al-Shāʾ → al-Jady
   (§174–178).
3. Learn the north–south pair: al-Jady ahead means north and Suhayl ahead means south
   (§216).
4. Only then, the qibla:
   - the historical rules show that the qibla is tied to place;
   - the learner turns from True North (not Polaris) to the computed Pekan qibla bearing
     (KC-05, after the Qibla geodesy decisions).

Steps 1–3 would turn the existing `MODERN_PEDAGOGICAL` helper line into cited
intermediate steps where the sources allow. Polaris and terrestrial True North remain
distinct targets.
