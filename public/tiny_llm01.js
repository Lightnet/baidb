// mini-llm-final-working.js
class MiniLLM {
  constructor(config = {}) {
    this.vocabSize = config.vocabSize || 50;
    this.nEmb = config.nEmb || 32;
    this.nHead = config.nHead || 4;
    this.nLayer = config.nLayer || 3;
    this.blockSize = config.blockSize || 32;
    this.headSize = this.nEmb / this.nHead;

    // === ALL PARAMETERS ARE PLAIN JS ARRAYS ===
    this.tokenEmb = this.randn2D(this.vocabSize, this.nEmb);
    this.posEmb   = this.randn2D(this.blockSize, this.nEmb);

    this.blocks = [];
    for (let i = 0; i < this.nLayer; i++) {
      this.blocks.push({
        ln1_w: this.randn1D(this.nEmb), ln1_b: this.zeros1D(this.nEmb),
        ln2_w: this.randn1D(this.nEmb), ln2_b: this.zeros1D(this.nEmb),
        q: this.randn2D(this.nEmb, this.nEmb),
        k: this.randn2D(this.nEmb, this.nEmb),
        v: this.randn2D(this.nEmb, this.nEmb),
        proj: this.randn2D(this.nEmb, this.nEmb),
        ff1: this.randn2D(this.nEmb, this.nEmb * 4),
        ff2: this.randn2D(this.nEmb * 4, this.nEmb),
      });
    }

    this.ln_f_w = this.randn1D(this.nEmb);
    this.ln_f_b = this.zeros1D(this.nEmb);
    this.lmHead = this.randn2D(this.nEmb, this.vocabSize); // [emb, vocab]
  }

  // --- Pure JS array helpers ---
  randn1D(n)   { return Array.from({length: n}, () => this.gaussian()); }
  zeros1D(n)  { return Array(n).fill(0); }
  randn2D(r,c) { return Array.from({length: r}, () => this.randn1D(c)); }
  zeros2D(r,c) { return Array.from({length: r}, () => this.zeros1D(c)); }

  gaussian() {
    const u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v);
  }

  matmul(a, b) { // a: [m,p], b: [p,n] → [m,n]
    const [m, p] = [a.length, a[0].length];
    const n = b[0].length;
    const c = this.zeros2D(m, n);
    for (let i = 0; i < m; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < p; k++)
          c[i][j] += a[i][k] * b[k][j];
    return c;
  }

  transpose(m) {
    return m[0].map((_, j) => m.map(row => row[j]));
  }

  softmax(row) {
    const max = Math.max(...row);
    const exps = row.map(x => Math.exp(x - max));
    const sum = exps.reduce((a,b) => a+b, 0);
    return exps.map(x => x / sum);
  }

  layerNorm(x, gamma, beta) { // x: 2D [seq,emb], gamma/beta: 1D [emb]
    return x.map(row => {
      const mean = row.reduce((a,b)=>a+b,0) / row.length;
      const variance = row.reduce((a,b)=>a + (b-mean)**2, 0) / row.length;
      const std = Math.sqrt(variance + 1e-6);
      return row.map((v, j) => gamma[j] * (v - mean) / std + beta[j]);
    });
  }

  attention(x, block) {
    const q = this.matmul(x, block.q);
    const k = this.matmul(x, block.k);
    const v = this.matmul(x, block.v);

    let scores = this.matmul(q, this.transpose(k));
    scores = scores.map(r => r.map(v => v / Math.sqrt(this.headSize)));
    const weights = scores.map(r => this.softmax(r));
    return this.matmul(weights, v);
  }

  forward(tokens) {
    let seq = tokens.slice(-this.blockSize);
    if (seq.length === 0) return [];

    // Embedding lookup + positional
    let x = seq.map((tok, i) => 
      this.tokenEmb[tok].map((v, j) => v + this.posEmb[i][j])
    );

    for (const b of this.blocks) {
      // Attention + residual
      const attnOut = this.matmul(this.attention(this.layerNorm(x, b.ln1_w, b.ln1_b), b), b.proj);
      x = x.map((row, i) => row.map((v, j) => v + attnOut[i][j]));

      // FFN + residual
      let ffn = this.matmul(this.layerNorm(x, b.ln2_w, b.ln2_b), b.ff1);
      ffn = ffn.map(row => row.map(Math.tanh));
      const ffnOut = this.matmul(ffn, b.ff2);
      x = x.map((row, i) => row.map((v, j) => v + ffnOut[i][j]));
    }

    x = this.layerNorm(x, this.ln_f_w, this.ln_f_b);
    return this.matmul(x, this.lmHead); // [seq, vocab]
  }

  generate(prompt = [], maxNew = 30) {
    let tokens = [...prompt];
    for (let i = 0; i < maxNew; i++) {
      const logits = this.forward(tokens);
      if (logits.length === 0) break;
      const probs = this.softmax(logits.at(-1));
      const next = this.sample(probs);
      tokens.push(next);
    }
    return tokens;
  }

  sample(probs) {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (r <= cum) return i;
    }
    return probs.length-1;
  }
}

// =============== TEST ===============
const vocab = "abcdefghijklmnopqrstuvwxyz .,!?\n".split('');
const vocabSize = vocab.length;

const tokenizer = {
  encode: s => [...s].map(c => vocab.indexOf(c)).filter(i => i >= 0),
  decode: a => a.map(i => vocab[i] || '').join('')
};

const model = new MiniLLM({
  vocabSize,
  nEmb: 64,
  nHead: 4,
  nLayer: 4,
  blockSize: 64
});

const prompt = tokenizer.encode("hello");
const result = model.generate(prompt, 80);

console.log("Prompt :", tokenizer.decode(prompt));
console.log("Output :", tokenizer.decode(result));

/*
Prompt : hello
Output : hello kxjwqmbzc... (random gibberish — normal, it's untrained!)
*/