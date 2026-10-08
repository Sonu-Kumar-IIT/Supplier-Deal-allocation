from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
ss = getSampleStyleSheet()
B = ParagraphStyle("b", parent=ss["Normal"], fontSize=7.6, leading=9.4)
H = ParagraphStyle("h", parent=ss["Heading3"], fontSize=9.2, leading=11, spaceBefore=3, spaceAfter=1)
T = ParagraphStyle("t", parent=ss["Title"], fontSize=13, leading=15, spaceAfter=0)
d = SimpleDocTemplate("InClassActivity_study_guide.pdf", pagesize=letter, leftMargin=34, rightMargin=34, topMargin=26, bottomMargin=22)
S = [Paragraph("SRILM n-gram LM In-Class Activity - Worked Solution (Study Guide)", T),
     Paragraph("<i>Practice material for exam preparation; code in roll-colab.ipynb. Brown corpus, bigram unless stated; test set = brown-test.txt (305,056 words).</i>", B),
     Paragraph("A. Toy corpus (5 sentences, 22 predicted tokens)", H),
     Paragraph("<b>Q1 bigram:</b> P(S1 = &lt;s&gt; Sam I do I like &lt;/s&gt;) = 3/5·3/5·1/5·1/2·2/5·2/3 = 0.0096; P(S2 = &lt;s&gt; Sam I am &lt;/s&gt;) = 3/5·3/5·2/5·1/2 = 0.072 -> <b>S2</b> is better. "
               "<b>Q2 unigram:</b> S1 = 3.3e-5, S2 = 1.07e-3 -> <b>S2</b>. "
               "<b>Q3:</b> 'linguistics' is unseen: P(linguistics|like) = 0/3, so unsmoothed unigram and bigram both give 0; add-one gives 3.6e-6 (unigram) and 3.3e-5 (bigram), using V = 8 word types. Per-word bigram terms: Sam|&lt;s&gt; .6, I|Sam .6, do|I .2, like|do .5, linguistics|like 0.", B),
     Paragraph("B. SRILM pipeline (verified): counts -> LM -> perplexity", H),
     Paragraph("<font face='Courier'>ngram-count -text brown-train.txt -order 2 -write train.count -unk -lm train.lm -addsmooth 0</font> then <font face='Courier'>ngram -lm train.lm -ppl brown-test.txt [-debug 2]</font>. "
               "Cross-check: count of 'the' = 38,810 from both <font face='Courier'>grep -c '^the$'</font> on the token stream and the .count file.", B),
     Paragraph("C. Results (test perplexity)", H)]
rows = [["Model", "Smoothing", "PPL", "Zero-probs"],
        ["Bigram", "add-0 (+unk)", "6270.9", "39,856"], ["Bigram", "add-1", "2493.2", "0"], ["Bigram", "add-0.1", "1208.8", "0"],
        ["Bigram", "Good-Turing (default)", "642.3", "0"], ["Bigram", "Kneser-Ney (interp.)", "617.9", "0"],
        ["Bigram", "Witten-Bell (interp.)", "416.2", "0"], ["Bigram", "Modified KN (interp.)", "362.2", "0"],
        ["Trigram", "add-0 / Good-Turing / KN", "6145.4 / 629.2 / 587.1", "39,856 / 0 / 0"],
        ["Bi, lowercase+no punct (KN)", "own test text", "916.4", "0"], ["Bi, no stopwords (KN)", "own test text", "1922.0", "0"],
        ["Uni+Bi mix, add .001, λ=.7", "dev 581.0 (tuned)", "681.3 (test)", "0"]]
t = Table(rows, colWidths=[150, 150, 120, 90])
t.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 7), ("LEADING", (0, 0), (-1, -1), 8), ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                       ("GRID", (0, 0), (-1, -1), .3, colors.grey), ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
S += [t, Paragraph("D. Answers to Section 6", H),
 Paragraph("<b>1. -inf:</b> with <font face='Courier'>-addsmooth 0</font> (add-0 = plain relative frequency) &lt;unk&gt; has count 0, so every OOV test word (18,639 here) has P=0, log P=-inf; "
           "<font face='Courier'>-unk</font> only keeps &lt;unk&gt; in the vocabulary so OOVs map to it. Perplexity (6270.9) is misleading because zero-probability events are excluded. Fix: any real smoothing/discounting gives &lt;unk&gt; mass.", B),
 Paragraph("<b>2. Smoothing:</b> discounting methods (GT, KN, WB) beat add-delta by a wide margin (362-642 vs 1209-2493) and remove all zero probabilities; add-delta over-allocates mass to the huge unseen event space. "
           "Modified KN and Witten-Bell were best here; the ranking of KN vs WB may differ on other corpora/settings.", B),
 Paragraph("<b>3. Trigram:</b> KN 587 vs 618 for bigram (modest gain); unsmoothed trigram still has -inf. Longer context helps but sparsity grows (many unseen trigrams, so back-off/interpolation is essential).", B),
 Paragraph("<b>4. Pre-processing:</b> removing punctuation/stopwords changes the token stream itself, so perplexities across rows are <i>not comparable</i>: the remaining content words are harder to predict, which raises per-word ppl (916-4246), while total log-prob improves because there are fewer words. Compare only models evaluated on identical text.", B),
 Paragraph("<b>5. Interpolation:</b> trained unigram and bigram (add-delta) models, scored with <font face='Courier'>ngram -lm bi.lm -mix-lm uni.lm -lambda L</font> (L weights the main bigram LM). Grid over add-delta ∈ {.001,.01,.1,.5} and L ∈ {.1,...,1}; best on dev: add=0.001, L=0.7, dev ppl 581.0, test ppl 681.3. "
           "Note it is worse than KN (618) on test: simple add-delta with interpolation cannot match proper discounting.", B)]
d.build(S)
