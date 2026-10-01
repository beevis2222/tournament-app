# Scramble rules (confirmed by Justin, Oct 1 2026)

These rules are what the app follows. If the club changes one, update this file first, then the code and tests.

## Format
- Teams of 4 play a scramble and post one score per hole. 2- and 3-person teams are supported too, for short teams.
- One or more rounds, 18 holes or a 9-hole event (front or back). A round can be shortened to 9 holes or called off because of weather.

## Scoring: gross AND net
- Both boards are calculated from the same team scores.
- **A team can win both gross and net.** The two lists are completely separate.

## Team handicap: USGA weighting
- Work out each player's course handicap from their tee: Index × (Slope ÷ 113) + (Rating − Par). Don't round it.
- Sort the four from low to high and take **25% of A, 20% of B, 15% of C, 10% of D**. Add them up, then round half up (7.5 becomes 8).
  - 3-person team: 20% / 15% / 10%. 2-person team: 35% / 15%.
- For a 9-hole round, halve the total before rounding.
- Strokes go on the hardest holes by the course stroke index. A plus team gives strokes back on the easiest holes.
- Example: course handicaps 4, 10, 16, 22 → 1 + 2 + 2.4 + 2.2 = 7.6 → **8 strokes**, one each on stroke index 1-8.

## Teams
Either, chosen per event:
- **Players sign up as teams.** Foursomes come in already set and are entered in the order listed.
- **Pro makes balanced teams.** Players are sorted by index and snake-drafted (1-2-3-3-2-1...) so every team is even. Leftover players become alternates.

## Flights (optional)
- Teams are sorted by team handicap and split as evenly as possible, lowest handicaps in the top flight. When the split isn't even, the top flights get the extra team.

## Ties
- **No tiebreak.** Tied teams share the position (T1, T1, 3).
- Prize money: tied teams split the combined money for the places they cover. Two teams tied for 1st with a 50/30/20 split each get (50% + 30%) ÷ 2.

## WD / DQ / No show
- These teams drop to the bottom of both boards, can't place, and can't win money.

## Not decided yet (ask Justin before building)
- Minimum drives per player. Does the club require them, and should the app track them?
- Gross and net prize split. Same purse for both, or different?
- Ties at a flight cutoff when splitting teams into flights.
