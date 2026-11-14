---
name: import-expo
description: Research a convention or market (official site, booking portals, attendee reports), summarize artist-alley details for user review, then generate validated Expo Tracker import JSON under imports/. Use when the user says research xxxx expo, research a convention or con, pastes an expo URL, asks to scrape vendor or artist-alley info, or wants an import JSON for Expo Tracker.
---

# Research and Import Expo

Follow a strict three-step loop. Do **not** write the JSON file in Step 1 unless the user explicitly asks to skip review and output JSON immediately.

## Step 1: Research and Summarize

1. Fetch the user-supplied URL (`WebFetch`), including artist alley, vendor/exhibitor, FAQ, floor plan, and ticket subpages.
2. Run targeted `WebSearch` queries to fill gaps that official homepages omit:
   - Recent past and upcoming edition dates.
   - Artist Alley application open/close dates, booking portal (`Eventeny`, `EventHub`, `Google Forms`, `Leap`, etc.), table cost, and rules (original art vs fanart, AI policy, merch caps, juried vs first-come).
   - Attendance with citable sources: official press, local news, convention bureau, FanCons/AnimeCons, or photographer/attendee reports. If no headcount is published, report **No official count** plus any venue-capacity or sister-show clues. Never invent an attendance number.
   - Market segment (anime, comic/pop-culture, gaming, indie/zine/craft market, furry, etc.) and organizer.
3. Present a compact summary in chat (if formatting a table in chat, follow the `visualize` skill if available) covering:
   - **Expo and aliases:** canonical series name (without year/season) and distinct acronyms or alternate names.
   - **Location:** city, state, and venue.
   - **Segment and organizer:** market niche and parent organizer/sister shows.
   - **Editions:** each cycle (`2026`, `2027`, `2027-summer`, etc.), event dates, and artist-alley application window/portal.
   - **Table cost:** Artist Alley vs vendor prices, what is included (table size, badges, drape), deposit vs full, and the source URL. Use **Not posted** when unpublished. There is no `tableCost` JSON field; put a short cost note in `notes` only when the user confirms.
   - **Attendance:** reported count with source links, or unpublished status with comparison context.
   - **Open calls:** fields left omitted unless the user wants to set a value (such as a reasoned `estimatedAttendance`, `interest`, or edition `status`).
4. **Stop and wait** for the user to review before generating JSON.

## Step 2: Review and Iterate

Refine findings across as many turns as the user wants:
- Answer follow-up questions (for example, sister-show attendance or sanity-checking an estimate).
- Record any user overrides (`estimatedAttendance`, `interest`, `status`, which cycles to keep, custom `notes`).
- Proceed to Step 3 once the user confirms or asks for the import JSON.

## Step 3: Write and Validate Import JSON

1. Write `imports/<kebab-slug>.json` (`imports/` is gitignored). Multiple expos researched together may share one `conventions` array.
2. Follow the `DataFile` v1 rules in `src/domain/dataFile.ts`:
   - Root object: `{ "format": "expo-tracker", "version": 1, "conventions": [...] }`.
   - `name`: series name without trailing year, season, or cycle number (for example `"Rhode Island Anime Con"`, `"SacAnime"`).
   - `aliases`: **only** names/acronyms that normalize to a *different* key (for example `["RI Anime Con", "RIAC"]`). Never include spacing, punctuation, case, or year/season variants of `name` or of another alias — `normalizeName` folds those to the same key and `parseDataFile` rejects duplicate keys in one file.
   - `website`, `city`, `state`: strings; omit any that are unknown.
   - `estimatedAttendance`: non-negative integer; include **only** when backed by a source or agreed with the user in Step 2. Omit otherwise so merge import does not clobber existing data.
   - Personal fields (`interest`, edition `status`, `submittedAt`, `resultDate`, `paid`): omit unless the user asked to set them. (When `status` is omitted and `applicationStart` is in the future in `America/Los_Angeles`, Expo Tracker infers `waiting_to_apply` on import.)
   - `editions`: unique `cycle` per expo (`"2027"`, `"2027-summer"`, `"109"`). Dates must be real `YYYY-MM-DD` strings (`eventStart`, `eventEnd`, `applicationStart`, `applicationEnd`). Omit unknown dates.
   - `links`: `{ "url": string, "kind": "discord" | "gmail" | "google_form" | "eventeny" | "eventhub" | "other" }[]`. Map `forms.gle` / `docs.google.com/forms` to `google_form`, `eventeny.com` to `eventeny`, `eventhub.net` to `eventhub`, `discord.gg` / `discord.com` to `discord`, `mail.google.com` to `gmail`, and everything else to `other`.
   - `notes`: concise artist-alley context (organizer, hall/floor, table rules/cost, unposted application timing).
3. Validate every generated file immediately:
   ```bash
   pnpm exec tsx .cursor/skills/import-expo/scripts/validate-import.ts imports/<kebab-slug>.json
   ```
   If validation fails, fix the JSON and re-run until it prints `OK`.
4. Give the user the `imports/<kebab-slug>.json` path and remind them to import it on `/data` (with **Replace** unchecked to merge).

## Minimal JSON Example

```json
{
  "format": "expo-tracker",
  "version": 1,
  "conventions": [
    {
      "name": "Rhode Island Anime Con",
      "aliases": ["RI Anime Con", "RIAC"],
      "website": "https://rianimecon.com/",
      "city": "Providence",
      "state": "RI",
      "estimatedAttendance": 6000,
      "notes": "Altered Reality Entertainment. Artist Alley on main floor and upper level; original art only, no AI.",
      "editions": [
        {
          "cycle": "2027",
          "eventStart": "2027-06-12",
          "eventEnd": "2027-06-13",
          "links": [
            { "url": "https://rianimecon.com/artists/", "kind": "other" }
          ]
        }
      ]
    }
  ]
}
```
