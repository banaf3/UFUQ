# Phase 1 Milestone 2D.1C: owner route scope — Cassiopeia helper to al-Jady

- **Date:** 2026-11-01
- **Decision:** `OWNER_ROUTE_PREFERENCE_RECORDED`; `GAIA_FIRST_INSUFFICIENT_FOR_ROUTE`
- **Scope:** which stars the first learner route needs, what the local evidence supports
  for its names and relationships, whether it is available at Malaysian latitudes, and
  what that means for the Milestone 2D.1 catalogue decision
- **Not performed:** no cultural record, membership, line segment, guidance edge,
  catalogue row, tolerance, or route was approved; no runtime data was created

## 1. Owner preference

The owner's intended first learner route is a Cassiopeia-region helper pattern
("al-Kursī") that leads to al-Jady (the polar star), then to terrestrial True North,
with star knowledge drawn from the anwāʾ literature. This is recorded as an owner
preference under IMP-011. It selects the route to research first; it does not approve
any of its content. IMP-018 still requires the route to be data-driven, with no named
pattern hard-coded as the universal entry point.

## 2. What the evidence supports

Each row is one claim family. Classifications follow
`docs/references/syntheses/arabian-sky-evidence-synthesis.md`. Locators come from the
tracked source dossiers unless marked as a new pointer.

| Claim | Evidence and locator | Classification | Status |
| --- | --- | --- | --- |
| Cassiopeia's bright stars were seen as a **hand** (*al-kaff*, al-Kaff al-Khaḍīb) linked to al-Thurayyā | Kunitzsch 1961, entries 136a–c, printed p. 72 (PDF p. 74) | `OLD_ARABIAN` (philological) | `HUMAN_REVIEW_REQUIRED` |
| The same hand name occurs in an anwāʾ/azmina compilation | **New pointer:** al-Marzūqī, *al-Azmina wa-al-Amkina* (Dār al-Kutub al-ʿIlmiyya ed.), local text SHA-256 `30af8cbf…a314f`, lines ~6438, ~22133, ~23746 | `OLD_ARABIAN` candidate (later compiler's testimony) | Noisy OCR; page-image check required |
| Cassiopeia is the **chair** pattern *Dhāt al-Kursī* | Hafez 2010 (al-Ṣūfī translation), catalogue heading, PDF p. 151 | `GRECO_ARABIC_SCHOLARLY` | Exact Arabic and membership unresolved |
| The chair and the Bedouin hand are distinct traditions | Savage-Smith & Belloli 1985, printed p. 147 (PDF p. 159), as recorded in the private source catalogue | Scholarly context | Source file must be re-acquired (see §6) |
| *Kursī al-Jawzāʾ* is **not** Cassiopeia | Kunitzsch entries 148a–149, printed p. 75 (PDF p. 77) | Negative guard | Must be rejected as Cassiopeia evidence |
| al-Jady is the polar star, with reading variants *al-gady* / *al-gudayy* / *al-Juday* | Kunitzsch entry 107a, printed pp. 62–63; Hafez Tables 18/24 (HR 424) | `OLD_ARABIAN` reading history plus `GRECO_ARABIC_SCHOLARLY` crosswalk | Variants must be preserved |
| al-Jady was used for direction finding and Qibla inference | Ibn Qutaybah §31 (local PDF p. 68) and §§52–53 (PDF pp. 80–82); **new pointer:** al-Marzūqī, section on dawn, twilight, noon, inference by stars, and determining the Qibla (local text lines ~22088–22142) | `OLD_ARABIAN` historical context | `HISTORICAL_CONTEXT_ONLY`; never a modern Qibla algorithm |
| A line from Cassiopeia to the polar star | No source in the local library has been found for this construction | `MODERN_PEDAGOGICAL` | Needs educational review; must be labelled as modern |

Consequences:

- **"al-Kursī" and "anwāʾ" belong to different layers.** The anwāʾ literature attests
  the hand (al-Kaff al-Khaḍīb) and al-Jady. *Dhāt al-Kursī* comes from the translated
  Ptolemaic catalogue tradition (al-Ṣūfī). Both are authentic Islamic-era heritage, but
  the route must not present *Dhāt al-Kursī* as an anwāʾ or pre-Greek Arabian name.
- **The pattern's display label is an owner decision** (see §7). An honest default
  shows the Cassiopeia stars with both labels and their classifications.
- The route's guidance step from the helper pattern to al-Jady is a modern teaching
  construction. Only al-Jady's use for direction and Qibla is historically attested.

## 3. Availability at Malaysian latitudes

This is a **spike sensitivity check, not scientific evidence.** Method: the five
Cassiopeia candidates (HIP 746, 3179, 4427, 6686, 8886), the seven greater and seven
lesser Banāt Naʿsh candidates, and HIP 11767 from the 2B technical allowlist. Positions
come from the local ignored I/311 bytes at their J1991.25 epoch, without propagation or
precession (a sub-degree effect at this scale). Altitude is geometric, with no
refraction and no visibility threshold. The calculation samples one sidereal day in
one-minute steps at illustrative latitudes. These latitudes are not the approved UMPSA
Pekan observer. The script is private and its outputs are aggregates only.

| Quantity | 1° N | 3.5° N | 7° N |
| --- | --- | --- | --- |
| All 5 Cassiopeia candidates above the geometric horizon | 43.7% of the sidereal day | 46.3% | 50.0% |
| Highest altitude of the lowest Cassiopeia member | 27.3° | 29.8° | 33.3° |
| All 7 greater Banāt Naʿsh candidates above the horizon | 39.2% | 41.0% | 43.8% |
| Cassiopeia **or** greater Banāt Naʿsh fully up / both / neither | 82.9% / 0% / 17.1% | 87.4% / 0% / 12.6% | 93.8% / 0% / 6.3% |
| All 7 lesser Banāt Naʿsh candidates up; highest altitude of the lowest member | 44.4%; 1.1° | 51.3%; 3.6° | 59.2%; 7.0° |
| HIP 11767 highest altitude (always above the horizon) | 1.7° | 4.2° | 7.7° |

Consequences:

- At any fixed clock time the Cassiopeia route is available for roughly half the year.
  The greater Banāt Naʿsh route is complementary: the two are never both fully up, and
  together they cover about 83–94% of sidereal time. **Keep greater Banāt Naʿsh as the
  alternative route.** IMP-018's availability-filtered route selection already
  supports this without hard-coding either pattern.
- The lesser Banāt Naʿsh *pattern* is impractical as a helper in Malaysia, because its
  lowest member stays within a few degrees of the horizon. al-Jady remains the target.
- al-Jady itself is only about 2–8° above the geometric horizon in Malaysia. The lesson
  must teach estimating north from the helper pattern even when the polar star is hard
  to see. Near-horizon refraction and visibility stay outside ScientificProfileV1.

## 4. Catalogue coverage of the route

The hash-bound Gaia DR3 screen from Milestone 2D.1B
(`data/manifests/gaia-dr3-hip-screen-v1/acquisition-manifest.v1.json`) matched these
HIP IDs: 3179, 6686, 59774, 65378, 77055, 79822, 82080, and 85822.

| Route star set | Stars | Gaia DR3 Hipparcos-2 matches |
| --- | --- | --- |
| Primary: Cassiopeia candidates + al-Jady | 6 | **2** (HIP 3179, 6686); no match for 746, 4427, 8886, 11767 |
| Alternative: greater Banāt Naʿsh candidates | 7 | **2** (HIP 59774, 65378) |

These are bright stars, the regime where Gaia DR3 crossmatches are incomplete. The
2D.1 preference for a Gaia-first single source therefore cannot supply the owner's
route: four of its six minimal stars have no Gaia row, so the route would be
ineligible under ScientificProfileV1's fail-closed rule.

**Proposed plan revision (needs owner and astronomy review):** for the route's bright
stars, evaluate ESA Hipparcos 1997 (`hip_main`) as the primary astrometric source. Its
explicit `J1991.25 (TT)` epoch avoids I/311's unresolved time scale. Pair it with one
reviewed primary radial-velocity authority, and keep Gaia DR3 as a cross-check where a
match exists. This widens the existing Polaris-fallback question from one star to the
whole route. It does not decide it. The alternative is an implement-or-omit decision
for radial velocity with a quantified bound under AST-003, which is likewise not
decided here.

## 5. Proposed minimal allowlist for 2D row review

- **Primary route:** HIP 746, 3179, 4427, 6686, 8886, 11767 (6 rows).
- **Alternative route:** HIP 53910, 54061, 58001, 59774, 62956, 65378, 67301 (7 rows).
- **Deprioritized:** the remaining lesser Banāt Naʿsh candidates (72607, 75097, 77055,
  79822, 82080, 85822). They stay in the 2B technical list but are not needed by
  either route.

These are review candidates. Membership of the historical patterns is still
`FALAK_OR_CULTURAL_REVIEW_REQUIRED`.

## 6. References to acquire

| Priority | Reference | Why | How |
| --- | --- | --- | --- |
| 1 | E. Savage-Smith & A. P. A. Belloli, *Islamicate Celestial Globes: Their History, Construction, and Use*, Smithsonian Studies in History and Technology 46 (1985), DOI 10.5479/si.00810258.46.1 | Distinguishes the chair and Bedouin-hand traditions for Cassiopeia | Free: download `SSHT-0046_Lo_res.pdf` from the [Smithsonian repository](https://repository.si.edu/items/0d9cfccc-b8c0-44b6-a132-dd055de3aeaf) |
| 2 | G. R. Tibbetts, *Arab Navigation in the Indian Ocean before the Coming of the Portuguese* (Royal Asiatic Society, Oriental Translation Fund NS 42, London 1971; repr. 1981) | Translation of Ibn Mājid's *Kitāb al-Fawāʾid*. It is the standard source on Arabic star navigation (polar-star altitude, al-Farqadān) in the Indian Ocean world that includes Malaysia, and it fills the maritime-evidence gap | Buy (used/library) |
| 3 | P. Kunitzsch & T. Smart, *A Dictionary of Modern Star Names* (Sky Publishing, 2006), ISBN 978-1-931559-44-7 | Concise derivations of the Arabic-origin names of the Cassiopeia stars and Polaris | Buy |
| 4 | D. M. Varisco, "The Origin of the Anwāʾ in Arab Tradition," *Studia Islamica* 74 (1991), 5–28 | Formation of the anwāʾ system the owner wants to draw on | Library/JSTOR |
| 5 | Ibn Qutaybah, *Kitāb al-Anwāʾ*, ed. M. Ḥamīdullāh & Ch. Pellat (Hyderabad, 1956) | Edition-stable locators for §31 and §§52–53 | Library/buy |
| 6 | Ibn ʿĀṣim al-Thaqafī, *al-Anwāʾ wa-al-Azmina wa-Maʿrifat Aʿyān al-Kawākib fī al-Nujūm*, ed. N. Ḥ. al-Qaysī & M. N. al-Dulaymī (Dār al-Jīl, Beirut, 1996) | Replaces the lost local text | Buy or re-obtain |

## 7. Decisions still required

| ID | Decision | Owner |
| --- | --- | --- |
| D-1 | Display label for the Cassiopeia pattern: *Dhāt al-Kursī*, *al-Kaff al-Khaḍīb*, or both with their layer classifications | Owner, then cultural review |
| D-2 | Accept greater Banāt Naʿsh as the alternative route for the season when Cassiopeia is down | Owner |
| D-3 | Replace the Gaia-first preference for route stars with a Hipparcos 1997 bright-star source plus an RV authority, or decide RV implement-or-omit under AST-003 | Owner plus astronomy review |
| D-4 | Approve the modern helper-to-al-Jady guidance construction as `MODERN_PEDAGOGICAL` content | Educational review |

## 8. Tests this scope implies (later phases)

- With every other input fixed, the Cassiopeia route is eligible when all its
  required stars are above the geometric horizon, and ineligible otherwise.
- When Cassiopeia is down and greater Banāt Naʿsh is up, scenario selection
  deterministically chooses the alternative route, with no named-pattern branch.
- Content validation rejects *Kursī al-Jawzāʾ* as Cassiopeia evidence and rejects a
  *Dhāt al-Kursī* record classified as `OLD_ARABIAN`.
- A route star with no approved catalogue row makes the route ineligible (fail closed).
