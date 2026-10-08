# SRILM n-gram experiments for Google Colab (study material).
# Each "# %%" marks a cell: paste them into separate Colab cells, or upload this file and run: !python srilm_colab.py

# %% CELL 1 - CONFIG (edit this cell to change the experiments)
WORKDIR = "/content/srilm"          # folder that holds ngram, ngram-count, browndata/
NGRAM_ORDER = 2                     # n for the main model (2 = bigram, 3 = trigram)
SMOOTHINGS = {                      # name -> extra ngram-count options; add or remove entries freely
    "add-0": "-addsmooth 0",
    "add-1": "-addsmooth 1",
    "good-turing": "",              # SRILM default
    "witten-bell": "-wbdiscount -interpolate",
    "kneser-ney": "-kndiscount -interpolate",
}
ADD_GRID = [0.001, 0.01, 0.1, 0.5]  # add-delta values to tune for the mixture model
LAMBDA_GRID = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0]   # weight of the bigram LM (SRILM -lambda)

# %% CELL 2 - helpers
import os, re, subprocess
os.chdir(WORKDIR)
for b in ("ngram", "ngram-count"):
    os.chmod(b, 0o755)              # Colab drops the executable bit on uploads
os.makedirs("work", exist_ok=True)
TRAIN, DEV, TEST = "browndata/brown-train.txt", "browndata/brown-dev.txt", "browndata/brown-test.txt"

def sh(cmd):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r.stdout + r.stderr

def train(name, order, opts, text=TRAIN):
    sh(f"./ngram-count -text {text} -order {order} -write work/{name}.count -lm work/{name}.lm -unk {opts}")
    return f"work/{name}.lm"

def perplexity(lm, text, extra=""):
    out = sh(f"./ngram -lm {lm} -ppl {text} {extra}")
    m = re.search(r"(\d+) zeroprobs, logprob= (\S+) ppl= (\S+)", out)
    if not m:
        raise RuntimeError(out)
    return float(m.group(3)), int(m.group(1))        # (perplexity, zero-probability events)

# %% CELL 3 - Step 1: counts, and a UNIX cross-check
print(sh("./ngram-count -text browndata/brown-train.txt -order 2 -write work/brown-train.count"))
print("count file says :", sh("grep -P '^the\\t' work/brown-train.count").strip())
print("grep -c says    :", sh("tr ' ' '\\n' < browndata/brown-train.txt | grep -c '^the$'").strip())

# %% CELL 4 - Steps 2-3: compare smoothing methods
print(f"{'method':14s} {'ppl':>10s} {'zero-probs':>11s}")
for name, opts in SMOOTHINGS.items():
    lm = train(name, NGRAM_ORDER, opts)
    ppl, zeros = perplexity(lm, TEST)
    print(f"{name:14s} {ppl:10.1f} {zeros:11d}")

# %% CELL 5 - interpolated unigram+bigram model: tune on dev, report on test
best = (float("inf"), None, None)
for a in ADD_GRID:
    uni = train(f"uni_{a}", 1, f"-addsmooth {a}")
    bi = train(f"bi_{a}", 2, f"-addsmooth {a}")
    for lam in LAMBDA_GRID:
        ppl, _ = perplexity(bi, DEV, f"-mix-lm {uni} -lambda {lam}")
        if ppl < best[0]:
            best = (ppl, a, lam)
print("best on dev -> ppl %.1f, addsmooth %s, lambda %s" % best)
_, a, lam = best
test_ppl, _ = perplexity(f"work/bi_{a}.lm", TEST, f"-mix-lm work/uni_{a}.lm -lambda {lam}")
print("test ppl with those values: %.1f" % test_ppl)
