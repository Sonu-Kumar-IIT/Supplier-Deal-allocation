"""SRILM in-class activity: worked experiments (study guide). Run from the folder holding ngram, ngram-count, browndata/."""
import subprocess, re, os, json, sys
BIN = sys.argv[1] if len(sys.argv) > 1 else "."
W = "work"; os.makedirs(os.path.join(BIN, W), exist_ok=True)
def sh(c):
    r = subprocess.run(c, shell=True, capture_output=True, text=True, cwd=BIN); return r.stdout + r.stderr
def train(text, order, name, opts):
    sh(f"./ngram-count -text {text} -order {order} -write {W}/{name}.count -lm {W}/{name}.lm {opts}")
    return f"{W}/{name}.lm"
def ppl(lm, text, extra=""):
    o = sh(f"./ngram -lm {lm} -ppl {text} {extra}")
    m = re.search(r"(\d+) OOVs", o); z = re.search(r"(\d+) zeroprobs, logprob= (\S+) ppl= (\S+) ppl1= (\S+)", o)
    return dict(oov=int(m.group(1)), zero=int(z.group(1)), logprob=float(z.group(2)), ppl=float(z.group(3)), ppl1=float(z.group(4)))
TR, DEV, TE = "browndata/brown-train.txt", "browndata/brown-dev.txt", "browndata/brown-test.txt"
R = {}
# Q1: unsmoothed bigram
R["q1_unk_add0"] = ppl(train(TR, 2, "bi_add0", "-unk -addsmooth 0"), TE)
R["q1_nounk_add0"] = ppl(train(TR, 2, "bi_add0_nounk", "-addsmooth 0"), TE)
# Q2: other smoothing (bigram, -unk)
for k, o in {"gt": "", "wb": "-wbdiscount -interpolate", "kn": "-kndiscount -interpolate", "ukn": "-ukndiscount -interpolate",
             "add1": "-addsmooth 1", "add0.1": "-addsmooth 0.1"}.items():
    R["q2_" + k] = ppl(train(TR, 2, "bi_" + k, "-unk " + o), TE)
# Q3: trigram
for k, o in {"add0": "-addsmooth 0", "gt": "", "kn": "-kndiscount -interpolate"}.items():
    R["q3_tri_" + k] = ppl(train(TR, 3, "tri_" + k, "-unk " + o), TE)
# Q4: preprocessing
STOP = set("a an the of and or to in on at for with by is are was were be been it its this that these those i he she we they you as".split())
def prep(src, dst, punct, stop, lower):
    with open(os.path.join(BIN, src)) as f, open(os.path.join(BIN, dst), "w") as g:
        for l in f:
            if lower: l = l.lower()
            t = l.split()
            if punct: t = [w for w in t if re.search(r"\w", w)]
            if stop: t = [w for w in t if w.lower() not in STOP]
            if t: g.write(" ".join(t) + "\n")
for k, (p, s, lo) in {"punct": (1, 0, 1), "stop": (0, 1, 0), "both": (1, 1, 1)}.items():
    prep(TR, f"{W}/tr_{k}.txt", p, s, lo); prep(TE, f"{W}/te_{k}.txt", p, s, lo)
    R["q4_" + k] = ppl(train(f"{W}/tr_{k}.txt", 2, "p_" + k, "-unk -kndiscount -interpolate"), f"{W}/te_{k}.txt")
R["q4_base_kn"] = R["q2_kn"]
# Q5: mix of unigram + bigram, tune (addsmooth, lambda) on dev
grid = {}
for a in [0.001, 0.01, 0.1, 0.5]:
    uni = train(TR, 1, f"u_{a}", f"-unk -addsmooth {a}"); bi = train(TR, 2, f"b_{a}", f"-unk -addsmooth {a}")
    for lam in [0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0]:
        grid[f"{a}|{lam}"] = ppl(bi, DEV, f"-mix-lm {uni} -lambda {lam}")["ppl"]
best = min(grid, key=grid.get); ba, bl = best.split("|")
uni = train(TR, 1, f"u_{ba}", f"-unk -addsmooth {ba}"); bi = train(TR, 2, f"b_{ba}", f"-unk -addsmooth {ba}")
R["q5_grid"] = grid; R["q5_best"] = dict(addsmooth=float(ba), lam=float(bl), dev_ppl=grid[best],
                                         test=ppl(bi, TE, f"-mix-lm {uni} -lambda {bl}"))
json.dump(R, open("results.json", "w"), indent=1)
for k, v in R.items():
    if k != "q5_grid": print(k, v)
