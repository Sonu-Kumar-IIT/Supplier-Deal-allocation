from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
d = Document()
s = d.sections[0]
s.left_margin = s.right_margin = Inches(0.7); s.top_margin = s.bottom_margin = Inches(0.55)
st = d.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(9.5)
st.paragraph_format.space_after = Pt(2)
def head(t):
    p = d.add_paragraph(); r = p.add_run(t); r.bold = True; r.font.size = Pt(10.5)
    p.paragraph_format.space_before = Pt(5); p.paragraph_format.space_after = Pt(1)
def hint(t):
    p = d.add_paragraph(); r = p.add_run(t); r.italic = True; r.font.color.rgb = RGBColor(0x80, 0x80, 0x80)
t = d.add_paragraph(); r = t.add_run("SRILM In-Class Activity - Report"); r.bold = True; r.font.size = Pt(14)
d.add_paragraph("Name: ____________________    Course: ____________________    Date: ____________")
head("1. Setup")
hint("[Your words, 1-2 sentences: data (Brown train/dev/test sizes), tools (SRILM ngram-count, ngram), how you ran it.]")
head("2. Results (test-set perplexity, from my notebook output)")
rows = [("Model / setup", "Test ppl", "OOVs", "Zero-probs", "Interpolated?"),
        ("Bigram, no smoothing (-addsmooth 0 -unk)", "6270.9", "18,639", "39,856", "no"),
        ("Bigram, Good-Turing (default)", "642.3", "0", "0", "no"),
        ("Bigram, Witten-Bell", "396.8", "0", "0", "no"),
        ("Trigram, Witten-Bell", "385.1", "0", "0", "no"),
        ("Unigram+bigram mix (add-d=0.0005, lambda=0.7; tuned on dev, dev ppl 576.3)", "677.3", "0", "0", "yes")]
tb = d.add_table(rows=len(rows), cols=5); tb.style = "Table Grid"; tb.autofit = False
W = [3.6, 0.8, 0.8, 0.9, 1.0]
for i, row in enumerate(rows):
    for j, v in enumerate(row):
        c = tb.cell(i, j); c.width = Inches(W[j]); c.text = ""; p = c.paragraphs[0]; r = p.add_run(v); r.font.size = Pt(8.5); r.bold = (i == 0)
        p.paragraph_format.space_after = Pt(0)
for ex, q in [("3. Exercise 1 - why -inf, and what do -unk and -addsmooth 0 mean?", "[Your answer, 2-3 sentences. Use the 39,856 zero-probs and 18,639 OOVs.]"),
              ("4. Exercise 2 - other smoothing methods", "[Your answer, 2-3 sentences. Which methods did you try, which did best, and what happened to the zero-probs?]"),
              ("5. Exercise 3 - trigram model", "[Your answer, 2 sentences. Compare bigram vs trigram numbers for the same smoother.]"),
              ("6. Exercise 4 - punctuation / stop-word preprocessing", "[Your answer, 2-3 sentences. Can these perplexities be compared with the baseline? Why or why not?]"),
              ("7. Exercise 5 - interpolation and tuning", "[Your answer, 3 sentences. How you searched add-delta and lambda on dev, the best values, and the test result.]")]:
    head(ex); hint(q); d.add_paragraph("")
d.save("report_template.docx")
