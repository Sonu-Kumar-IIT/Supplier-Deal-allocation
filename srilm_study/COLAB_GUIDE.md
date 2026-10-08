# Running the SRILM experiments in Google Colab

Files: `srilm_colab.py` (the code) and your course zip (`drive-download-...zip`, containing `ngram`, `ngram-count`, `browndata/`).

## 1. Open a notebook
1. Go to https://colab.research.google.com and sign in.
2. File -> New notebook. (Runtime should be the default CPU, Linux; no GPU needed.)

## 2. Upload the course files
In the first cell run:
```python
from google.colab import files
up = files.upload()          # pick the course .zip in the dialog
```
Alternative: click the folder icon in the left sidebar and drag the zip in, or mount Drive:
`from google.colab import drive; drive.mount('/content/drive')` and use the path under `/content/drive/MyDrive/`.

## 3. Unzip into /content/srilm
```python
import zipfile, glob, os
os.makedirs('/content/srilm', exist_ok=True)
zipfile.ZipFile(glob.glob('/content/*.zip')[0]).extractall('/content/srilm')
!ls /content/srilm            # expect: ngram  ngram-count  browndata  ...
```
If `ls` shows one extra nested folder, change `WORKDIR` in step 5 to that folder.

## 4. Check the binaries run
```python
!chmod +x /content/srilm/ngram /content/srilm/ngram-count
!/content/srilm/ngram-count -help | head -3
```
(If you get "cannot execute binary file", the binary does not match Colab's Linux x86-64; see Troubleshooting.)

## 5. Add the code
Open `srilm_colab.py`. It is split by `# %%` markers into 5 cells. Either:
- **Cell by cell:** create one Colab cell per `# %%` block, paste, and run them in order (1 -> 5), or
- **Whole file:** upload `srilm_colab.py` the same way as in step 2, then run `!python srilm_colab.py`.

## 6. What you should see
```
count file says : the 38810        grep -c says : 38810
add-0 6270.9 (39856 zero-probs)   add-1 2493.2   good-turing 642.3
witten-bell 416.2                  kneser-ney 617.9
best on dev -> ppl 581.0, addsmooth 0.001, lambda 0.7 ; test ppl 681.3
```

## 7. Updating the code (experiments to try)
Everything you change lives in **Cell 1 (CONFIG)**; then re-run cells 1-5 (Runtime -> Run all):
- `NGRAM_ORDER = 3` -> trigram models in the smoothing comparison.
- Add a method to `SMOOTHINGS`, e.g. `"modified-kn": "-ukndiscount -interpolate"`.
- Widen the tuning search: `ADD_GRID = [0.0001, 0.001, 0.01]`, `LAMBDA_GRID = [0.5, 0.6, 0.7, 0.8]` (a finer grid takes longer).
- Per-sentence probabilities (handout Section 5): in a new cell run
  `!cd /content/srilm && ./ngram -lm work/kneser-ney.lm -ppl browndata/brown-test.txt -debug 2 | head -30`.
- Preprocessing (exercise 4): create a cleaned copy of train/test, point `TRAIN`/`TEST` in Cell 2 at it, re-run. Remember perplexities on differently-processed text are not comparable.

## Troubleshooting
- `FileNotFoundError` on `ngram` -> wrong `WORKDIR` (nested folder) or zip not extracted.
- `Permission denied` -> run the `chmod +x` from step 4.
- `cannot execute binary file` -> install SRILM from source or a package instead, e.g. SRILM is not in Colab by default, so build it from source per the SRILM docs, or use `kenlm`/`nltk.lm` as a substitute and adapt the commands.
- Runtime restarted -> `/content` is wiped; redo steps 2-3.
