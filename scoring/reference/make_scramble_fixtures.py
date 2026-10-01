"""Generate scramble parity fixtures from the independent calculator.

Builds random scramble events in the prototype's JSON shape, computes the
expected results with golf_math.py (written separately from the app), and
writes test/fixtures/scramble-parity.json. The TypeScript tests must match
every number.

Run from the scoring folder:  python3 reference/make_scramble_fixtures.py
"""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
import golf_math as gm

PARS = [4,4,3,5,4,4,3,4,5,4,3,4,5,4,4,3,5,4]
SI = [7,11,15,1,5,13,17,9,3,8,16,4,2,12,10,18,6,14]

def rand_tees(rng):
    tees = [{"id":"blue","name":"Blue","rating":72.1,"slope":131},
            {"id":"white","name":"White","rating":70.4,"slope":127},
            {"id":"gold","name":"Gold","rating":68.2,"slope":119}]
    for t in tees:
        t["rating"] = round(rng.uniform(66, 75), 1); t["slope"] = rng.randint(105, 145)
    if rng.random() < 0.3:  # a tee with its own par
        t = tees[2]; t["custom"] = True
        p = PARS[:]; p[rng.randrange(18)] += rng.choice([-1, 1]); t["pars"] = p
        s = SI[:]; rng.shuffle(s); t["si"] = s
    return tees[:rng.randint(1, 3)]

def make_event(rng, k):
    tees = rand_tees(rng)
    n_teams = rng.randint(1, 9)
    players, teams, pid = [], [], 0
    for ti in range(n_teams):
        size = 4 if rng.random() < 0.85 else rng.choice([2, 3])
        ids = []
        for _ in range(size):
            pid += 1
            r = rng.random()
            index = round(rng.uniform(-4, 0), 1) if r < 0.1 else round(rng.uniform(0, 40), 1)
            p = {"id": f"p{pid}", "name": f"Player {pid}", "index": index, "tee": rng.choice(tees)["id"]}
            if rng.random() < 0.05: p["nh"] = True
            players.append(p); ids.append(p["id"])
        teams.append({"id": f"t{ti}", "players": ids, "label": f"Team {ti+1}", "flight": 0})
    rounds = rng.randint(1, 3)
    holes_mode = rng.choice(["18", "18", "18", "front", "back"])
    rmode = {}
    for r in range(rounds):
        x = rng.random()
        if x < 0.12: rmode[str(r)] = "cancel"
        elif x < 0.22: rmode[str(r)] = rng.choice(["front", "back"])
    limits = {}
    if rng.random() < 0.3: limits["cap"] = rng.choice([18, 24, 28.4])
    if rng.random() < 0.3:
        limits["gap"] = rng.choice([6, 8, 10.5]); limits["gapMode"] = rng.choice(["flag", "reduce"])
    cards = []
    for r in range(rounds):
        c = {}
        for t in teams:
            if rng.random() < 0.1: continue  # team hasn't started
            row = []
            stop = 18 if rng.random() < 0.7 else rng.randint(0, 17)
            for h in range(18):
                row.append(None if h >= stop or rng.random() < 0.03 else max(1, PARS[h] + rng.choice([-2,-1,-1,0,0,0,0,1,1,2])))
            c[t["id"]] = {"team": row}
        cards.append(c)
    return {
        "id": f"ev{k}",
        "event": {"name": f"Scramble {k}", "format": "scramble", "scoring": "net", "rounds": rounds,
                  "teamSize": 4, "allowance": 100, "holesMode": holes_mode, "rmode": rmode,
                  "limits": limits, "pars": PARS, "si": SI, "tees": tees},
        "players": players,
        "pairings": {"teams": teams},
        "cards": cards,
    }

def expected(ev):
    players = {p["id"]: p for p in ev["players"]}
    out = {}
    for t in ev["pairings"]["teams"]:
        rows = []
        for r in range(ev["event"]["rounds"]):
            thru, gross, net_topar, _ = gm.round_totals(ev, r, t, players)
            gross_topar = sum(gm.gross_for(ev, r, t, h) - ev["event"]["pars"][h]
                              for h in gm.ev_holes(ev, r) if gm.gross_for(ev, r, t, h) is not None)
            strokes = [gm.stroke_on(ev, gm.team_hcp(ev, t, players, r), h, r, None) for h in range(18)]
            rows.append({"handicap": gm.team_hcp(ev, t, players, r), "thru": thru, "gross": gross,
                         "grossToPar": gross_topar, "netToPar": net_topar,
                         "strokes": [s if h in gm.ev_holes(ev, r) else 0 for h, s in enumerate(strokes)]})
        out[t["id"]] = {"handicap18": gm.team_hcp(ev, t, players), "rounds": rows,
                        "courseHandicaps": [gm.course_hcp(ev, players[i]) for i in t["players"]]}
    return out

def main():
    rng = random.Random(20261001)
    cases = []
    for k in range(400):
        ev = make_event(rng, k)
        cases.append({"event": ev, "expected": expected(ev)})
    path = os.path.join(os.path.dirname(__file__), "..", "test", "fixtures", "scramble-parity.json")
    with open(path, "w") as f: json.dump({"generatedBy": "reference/make_scramble_fixtures.py", "seed": 20261001, "cases": cases}, f)
    print(f"wrote {len(cases)} cases")

if __name__ == "__main__":
    main()
