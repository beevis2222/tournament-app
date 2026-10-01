"""Independent golf scoring calculator for Starter.

Recomputes handicaps, strokes, net scores and totals from a Starter event JSON
(the same shape as a backup file's events). Used to verify any build matches
the prototype. Pure Python, no dependencies.

Usage: load an event dict (e.g. json.load(open(backup))['events'][0]) and call
net_for / gross_for / ph_r / stroke_on / team_hcp. See references/scoring-math.md.
"""
import math
def jsround(x): return math.floor(x+0.5)
def setv(pg,id,v):
    pg.evaluate("([id,v])=>{const el=document.getElementById(id); el.value=v; el.dispatchEvent(new Event('change',{bubbles:true}));}",[id,str(v)])
def go(pg,t): pg.evaluate(f"starterGo('{t}')")
def new_event(pg):
    pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    pg.click('#eventsBtn'); pg.click('[data-tpl-new=blank]'); pg.wait_for_timeout(30)
def samples(pg,n):
    go(pg,'field'); pg.fill('#sampleN',str(n)); pg.click('#demoBtn')
def simulate(pg):
    go(pg,'board'); pg.click('#simAllBtn'); pg.wait_for_timeout(30)
def state(pg):
    db=json.loads(pg.evaluate("localStorage.getItem('starter-proto-v5')"))
    return db['events'][db['current']]
def text_of(pg,sel): return pg.inner_text(sel) if pg.query_selector(sel) else ''
def bad_text(s):
    m=BAD.search(s); return None if not m else s[max(0,m.start()-60):m.end()+40].replace('\n',' | ')
def table_rows(pg,sel='#boardOut .board tbody tr'):
    return pg.evaluate(f"[...document.querySelectorAll('{sel}')].map(tr=>[...tr.children].map(td=>td.innerText.trim()))")
# ---- golf math (mirror of the rules, written independently) ----
def par(ev): return sum(ev['event']['pars'])
def tee(ev,p):
    T=ev['event']['tees']; return next((t for t in T if t['id']==p.get('tee')),T[0])
def eff_index(ev,p):
    L=ev['event'].get('limits') or {}; i=p['index']
    cap=L.get('cap'); gap=L.get('gap')
    if cap is not None and i>cap: i=cap
    if gap is not None and L.get('gapMode')=='reduce' and ev.get('pairings') and ev['event'].get('teamSize',1)>1:
        pl={x['id']:x for x in ev['players']}
        for t in ev['pairings']['teams']:
            if p['id'] in t['players']:
                ids=[x for x in t['players'] if x in pl and not pl[x].get('nh')]
                if len(ids)>=2:
                    capd=lambda q: min(pl[q]['index'],cap) if cap is not None else pl[q]['index']
                    lo=min(capd(q) for q in ids)
                    if i>lo+gap: i=round((lo+gap)*10)/10
    return i
def tee_pars(ev,p):
    t=tee(ev,p) if p else None
    return t['pars'] if t and t.get('custom') and len(t.get('pars') or [])==18 else ev['event']['pars']
def tee_si(ev,p):
    t=tee(ev,p) if p else None
    return t['si'] if t and t.get('custom') and len(t.get('si') or [])==18 else ev['event']['si']
def course_hcp(ev,p):
    if p.get('nh'): return 0
    t=tee(ev,p); return eff_index(ev,p)*(t['slope']/113)+(t['rating']-sum(tee_pars(ev,p)))
def ev_holes(ev,r):
    e=ev['event']
    if e['format'] in ('matchplay','fourball'): return list(range(18))
    m=(e.get('rmode') or {}).get(str(r)) or (e.get('rmode') or {}).get(r) or 'full'
    if m=='cancel': return []
    hm=m if m in ('front','back') else (e.get('holesMode') or '18')
    return list(range(9)) if hm=='front' else list(range(9,18)) if hm=='back' else list(range(18))
def ph_r(ev,p,r):
    e=ev['event']
    if e['scoring']=='gross': return 0
    base=course_hcp(ev,p)*e['allowance']/100
    return jsround(base/2) if len(ev_holes(ev,r))==9 else jsround(base)
def stroke_on(ev,n,h,r,p):
    si=tee_si(ev,p); hs=ev_holes(ev,r)
    if len(hs)==18 or not hs:
        x=si[h]
        if n>=0: return n//18+(1 if x<=n%18 else 0)
        pl=-n; return -(pl//18+(1 if x>18-(pl%18) else 0))
    ranked=sorted(hs,key=lambda k:si[k]); pos=ranked.index(h) if h in ranked else -1; L=len(hs)
    if pos<0: return 0
    if n>=0: return n//L+(1 if pos<n%L else 0)
    pl=-n; return -(pl//L+(1 if pos>=L-(pl%L) else 0))
def ph(ev,p):
    e=ev['event']
    if e['scoring']=='gross': return 0
    return jsround(course_hcp(ev,p)*e['allowance']/100)
def strokes_on(ev,h,hole):
    si=ev['event']['si'][hole]
    if h>=0: return h//18+(1 if si<=h%18 else 0)
    pl=-h; return -(pl//18+(1 if si>18-(pl%18) else 0))
W={2:[.35,.15],3:[.20,.15,.10],4:[.25,.20,.15,.10]}
def team_hcp(ev,t,players,r=None):
    e=ev['event']; ps=[players[i] for i in t['players'] if i in players]
    nine=r is not None and len(ev_holes(ev,r))==9
    if e['format']=='scramble':
        if e['scoring']=='gross': return 0
        w=W.get(len(ps),W[4]); ch=sorted(course_hcp(ev,p) for p in ps)
        v=sum(c*(w[i] if i<len(w) else 0) for i,c in enumerate(ch))
        return jsround(v/2 if nine else v)
    return sum(ph_r(ev,p,r) if r is not None else ph(ev,p) for p in ps)
def card(ev,r,tid,key,h):
    try:
        v=ev['cards'][r][tid][key][h]; return None if v is None else int(v)
    except Exception: return None
def net_for(ev,r,t,players,h):
    e=ev['event']
    if h not in ev_holes(ev,r): return None
    if e['format']=='scramble':
        g=card(ev,r,t['id'],'team',h); return None if g is None else g-stroke_on(ev,team_hcp(ev,t,players,r),h,r,None)
    vals=[]
    for pid in t['players']:
        p=players.get(pid); g=card(ev,r,t['id'],pid,h)
        if p and g is not None: vals.append(g-stroke_on(ev,ph_r(ev,p,r),h,r,p))
    return min(vals) if vals else None
def gross_for(ev,r,t,h):
    if h not in ev_holes(ev,r): return None
    if ev['event']['format']=='scramble': return card(ev,r,t['id'],'team',h)
    vals=[card(ev,r,t['id'],pid,h) for pid in t['players']]; vals=[v for v in vals if v is not None]
    return min(vals) if vals else None
def fmt_par(n): return 'E' if n==0 else (f'+{n}' if n>0 else str(n))

def stableford_points(ev,net,h,player):
    return max(0,2+tee_pars(ev,player)[h]-net)

def round_totals(ev,r,team,players):
    """Returns (holes_scored, gross, net_to_par, stableford_points) for one team in round r."""
    e=ev['event']; thru=gross=topar=pts=0
    p1=players[team['players'][0]] if e.get('teamSize',1)==1 else None
    for h in ev_holes(ev,r):
        n=net_for(ev,r,team,players,h)
        if n is None: continue
        thru+=1; gross+=gross_for(ev,r,team,h); topar+=n-e['pars'][h]
        pts+=max(0,2+(tee_pars(ev,p1) if p1 else e['pars'])[h]-n)
    return thru,gross,topar,pts
