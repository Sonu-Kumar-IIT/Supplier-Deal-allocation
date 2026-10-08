import json
exp = open("experiments.py").read()
cells = []
md = lambda s: cells.append({"cell_type":"markdown","metadata":{},"source":s.strip("\n").splitlines(True)})
code = lambda s: cells.append({"cell_type":"code","metadata":{},"execution_count":None,"outputs":[],"source":s.strip("\n").splitlines(True)})
md("""# SRILM In-Class Activity - worked solution (STUDY GUIDE)
Practice material for exam preparation. Re-derive and re-run everything yourself before relying on it.
**Setup (Colab):** upload the course zip (browndata/, ngram, ngram-count) and run the next cell.""")
code("""import os, subprocess
if os.path.exists('/content'):                      # Colab only
    from google.colab import files
    up = files.upload()                             # choose the course .zip
    for n in up: subprocess.run(['unzip','-o','-q',n])
for b in ['ngram','ngram-count']:
    if os.path.exists(b): os.chmod(b, 0o755)
print(subprocess.run('./ngram-count -help | head -3', shell=True, capture_output=True, text=True).stdout)""")
md("## Part A - Toy example (LM-InClass-Activity): counts and MLE")
code('''from collections import Counter
D = ["<s> I am Sam </s>","<s> Sam I am </s>","<s> Sam I like </s>","<s> Sam I do like </s>","<s> do I like Sam </s>"]
uni, bi = Counter(), Counter()
for s in D:
    t = s.split(); uni.update(t); bi.update(zip(t, t[1:]))
N = sum(uni.values()) - uni["<s>"]                  # predicted tokens (<s> is never predicted)
def p_uni(w, add=0, V=0): return (uni[w] + add) / (N + add * V)
def p_bi(w, prev, add=0, V=0): return (bi[(prev, w)] + add) / (uni[prev] + add * V)
def sent(s, kind, **kw):
    t = s.split(); p = 1.0; parts = []
    for a, b in zip(t, t[1:]):
        q = p_bi(b, a, **kw) if kind == "bi" else p_uni(b, **kw)
        parts.append((b, q)); p *= q
    return p, parts
S1, S2 = "<s> Sam I do I like </s>", "<s> Sam I am </s>"
for k in ("bi", "uni"):
    print(k, "S1 =", sent(S1, k)[0], " S2 =", sent(S2, k)[0], "-> better:", "S2" if sent(S2, k)[0] > sent(S1, k)[0] else "S1")''')
md("""**Q1/Q2 answer:** S2 (`<s> Sam I am </s>`) wins under both models (bigram 0.072 vs 0.0096; unigram 1.07e-3 vs 3.3e-5).
Reason: S1 contains the rare transitions I->do (1/5) and do->I (1/2) and is longer; more factors < 1 multiply to a smaller probability.""")
code('''S3 = "<s> Sam I do like linguistics </s>"
print("MLE unigram:", sent(S3, "uni")[0])''')
code('''t = S3.split()
print("bigram MLE per word:")
for a, b in zip(t, t[1:]):
    print(f"  P({b}|{a}) = {bi[(a,b)]}/{uni[a]}" + (f" = {p_bi(b,a):.3f}" if uni[a] else " (undefined, context unseen)"))
print("=> sentence probability is 0 (unseen word 'linguistics').")
V = len(uni) + 1                                   # + linguistics
print("add-one:", sent(S3, "uni", add=1, V=V)[0], sent(S3, "bi", add=1, V=V)[0])''')
md("**Q3 answer:** every term is non-zero except `linguistics` (count 0), so unsmoothed MLE gives probability 0 for the sentence in both models. Add-one (or any smoothing / `<unk>`) gives a small positive value.")
md("## Part B - SRILM on the Brown corpus (steps 1-3 of the handout)")
code('''import subprocess, re, os, json
BIN = "."; W = "work"; os.makedirs(W, exist_ok=True)
def sh(c): r = subprocess.run(c, shell=True, capture_output=True, text=True, cwd=BIN); return r.stdout + r.stderr
print(sh("./ngram-count -text browndata/brown-train.txt -order 2 -write work/brown-train.count"))
print(sh("head -5 work/brown-train.count; grep -c . work/brown-train.count"))
# cross-check a count with UNIX tools:  'the' occurrences (exact token)
print(sh("tr ' ' '\\\\n' < browndata/brown-train.txt | grep -c '^the$'"), sh("grep -P '^the\\\\t' work/brown-train.count"))''')
head = exp.split("R = {}")[0].replace('BIN = sys.argv[1] if len(sys.argv) > 1 else "."', 'BIN = "."')
head = "\n".join(l for l in head.splitlines() if not l.startswith('"""'))
code(head)
code('R = {}\n' + exp.split("R = {}\n")[1].split("json.dump")[0])
md("""## Part C - Answers to the exercises (numbers from the run above)
1. **-inf / OOV.** With `-addsmooth 0` every word's probability is its relative frequency, and `<unk>` gets count 0, so each OOV word has P = 0 and log P = -inf (39,856 zeroprobs on the test set; ppl 6270.9 only because zero-probability events are excluded from the perplexity). `-unk` keeps `<unk>` in the vocabulary so unseen test words are mapped to it; `-addsmooth 0` means add-0 (no smoothing). Fix: use real smoothing (Good-Turing/Kneser-Ney/Witten-Bell) or add-delta>0 so `<unk>` gets mass.
2. **Smoothing (bigram, test ppl):** add-1 2493, add-0.1 1209, Good-Turing 642, Kneser-Ney 618, Witten-Bell 416, modified KN 362; zero probabilities drop to 0 for all. Add-delta is poor on large vocabularies; discounting methods are far better.
3. **Trigram** (KN): 587 vs 618 for bigram; unsmoothed trigram still has -inf. Higher order helps a little but data sparsity grows.
4. **Preprocessing:** perplexities are NOT comparable across rows, because removing tokens changes the test text itself (fewer, harder-to-predict tokens give higher per-word ppl).
5. **Interpolation:** best on dev is addsmooth = 0.001, lambda = 0.7 (dev ppl 581.0); test ppl 681.3. SRILM's `-lambda` weights the *main* (`-lm`, bigram) model; `-mix-lm` is the unigram.""")
nb = {"cells":cells,"metadata":{"kernelspec":{"name":"python3","display_name":"Python 3","language":"python"},"colab":{"provenance":[]}},"nbformat":4,"nbformat_minor":5}
json.dump(nb, open("roll-colab.ipynb","w"), indent=1)
