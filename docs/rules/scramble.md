# Scramble rules (confirmed by Justin, Oct 1 2026)

These rules are what the app follows. If the club changes one, update this file first, then the code and tests.

## Format
- Teams of 4 play a scramble and post one score per hole. 2- and 3-person teams are supported too, for short teams.
- One or more rounds, 18 holes or a 9-hole event (front or back). A round can be shortened to 9 holes or called off because of weather.

## Scoring: gross AND net
- Both boards are calculated from the same team scores (only gross when the handicap setting is "None").
- **A team can win both gross and net.** The two lists are completely separate.

## Team handicap: chosen per event (default USGA)
Every method starts from each player's course handicap for their tee: Index × (Slope ÷ 113) + (Rating − Par). It isn't rounded until the end. Each method rounds half up (7.5 becomes 8), and for a 9-hole round the total is halved before rounding. Strokes go on the hardest holes by the course stroke index, and a plus team gives strokes back on the easiest holes.

| Setting | How it works | Example (course hcps 4, 10, 16, 22) |
|---|---|---|
| **USGA 25/20/15/10%** (club default) | Sort low to high: 25% of A, 20% of B, 15% of C, 10% of D. 3-man teams use 20/15/10, 2-man teams use 35/15. | 1 + 2 + 2.4 + 2.2 = 7.6 → **8** |
| **Custom percentages** | Your own percentages, low to high, set separately for 4-, 3- and 2-man teams. A team size without its own percentages uses the USGA ones. | 20/15/10/5: 0.8 + 1.5 + 1.6 + 1.1 = **5** |
| **Percent of combined** | Add up all the players' course handicaps and take a percent. | 10% of 52 = 5.2 → **5** |
| **None (gross only)** | No handicaps. Only the gross board shows. | **0** |

### Maximum team handicap (optional)
- If it's set, no team gets more strokes than that in a round. It's applied after rounding and works with every method above. Leave it empty for no limit.
- Example: USGA works out to 8 with a max of 6, so the team plays off **6**.
- Plus teams aren't affected.

## Prizes: shop gift cards
- There's usually no cash purse. Each place on each board (gross and net, per flight) wins a shop gift card amount, e.g. 1st $150, 2nd $100, 3rd $50.
- Ties split the combined amounts for the places they cover. Two teams tied for 1st each get ($150 + $100) ÷ 2 = $125, and the next team is 3rd and gets $50.

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
- Ties at a flight cutoff when splitting teams into flights.
- Maximum team handicap on a 9-hole round: right now the same max applies (a max of 6 means 6 strokes even over 9 holes). Should it be halved?
- Gift card ties: split evenly (current rule), or does the shop round to whole dollars?
- When custom percentages are only set for 4-man teams, short teams fall back to USGA. Confirm that's what the club wants.
