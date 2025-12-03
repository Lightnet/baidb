// ===============================================
// TINY GPT FROM SCRATCH IN PURE JAVASCRIPT
// ~250 lines | No dependencies | Runs in Node.js & Browser
// Educational version with deep comments
// ===============================================

class TinyLLM {
  constructor(config = {}) {
    // Hyperparameters — feel free to tweak
    this.vocabSize   = config.vocabSize   || 65;     // How many tokens exist
    this.nEmb        = config.nEmb        || 128;    // Embedding dimension (hidden size)
    this.nHead       = config.nHead       || 8;      // Number of attention heads
    this.nLayer      = config.nLayer      || 6;      // Number of transformer blocks
    this.blockSize   = config.blockSize   || 128;    // Max context length (sequence length)

    this.headSize = this.nEmb / this.nHead; // Size per head (e.g., 128 / 8 = 16)

    // -------------------------------
    // 1. TOKEN & POSITIONAL EMBEDDINGS
    // -------------------------------
    // Every token gets a learned vector
    this.tokenEmb = this.randn2D(this.vocabSize, this.nEmb);   // [vocab, emb]
    // Every position in the sequence gets a learned vector
    this.posEmb   = this.randn2D(this.blockSize, this.nEmb);   // [blockSize, emb]

    // -------------------------------
    // 2. TRANSFORMER BLOCKS
    // -------------------------------
    this.blocks = [];
    for (let i = 0; i < this.nLayer; i++) {
      this.blocks.push({
        // LayerNorm parameters (scale & shift)
        ln1_w: this.randn1D(this.nEmb), ln1_b: this.zeros1D(this.nEmb),
        ln2_w: this.randn1D(this.nEmb), ln2_b: this.zeros1D(this.nEmb),

        // Multi-Head Self-Attention weights
        q: this.randn2D(this.nEmb, this.nEmb),     // Query
        k: this.randn2D(this.nEmb, this.nEmb),     // Key
        v: this.randn2D(this.nEmb, this.nEmb),     // Value
        proj: this.randn2D(this.nEmb, this.nEmb),  // Output projection

        // Feed-Forward Network (MLP inside each block)
        ff1: this.randn2D(this.nEmb, this.nEmb * 4), // Expand
        ff2: this.randn2D(this.nEmb * 4, this.nEmb), // Shrink back
      });
    }

    // Final LayerNorm + Language Modeling Head
    this.ln_f_w = this.randn1D(this.nEmb);
    this.ln_f_b = this.zeros1D(this.nEmb);
    this.lmHead = this.randn2D(this.nEmb, this.vocabSize); // Predict next token
  }

  // ==============================================================
  // HELPER FUNCTIONS — PURE JS, NO LIBRARIES
  // ==============================================================

  // Random normal (Gaussian) — used for weight initialization
  gaussian() {
    const u = 1 - Math.random();
    const v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // 1D and 2D array creators
  randn1D(n) { return Array.from({length: n}, () => this.gaussian() * 0.02); } // small values!
  zeros1D(n) { return Array(n).fill(0); }
  randn2D(rows, cols) { return Array.from({length: rows}, () => this.randn1D(cols)); }
  zeros2D(rows, cols) { return Array.from({length: rows}, () => this.zeros1D(cols)); }

  // Matrix multiplication: A × B
  matmul(a, b) {
    // a: [m, p], b: [p, n] → result: [m, n]
    const [m, p] = [a.length, a[0].length];
    const n = b[0].length;
    const c = this.zeros2D(m, n);

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < p; k++) {
          sum += a[i][k] * b[k][j];
        }
        c[i][j] = sum;
      }
    }
    return c;
  }

  // Transpose matrix (used in attention: Q @ Kᵀ)
  transpose(m) {
    return m[0].map((_, col) => m.map(row => row[col]));
  }

  // Softmax over a 1D array (turns logits → probabilities)
  softmax(row) {
    const max = Math.max(...row);
    const exps = row.map(x => Math.exp(x - max)); // numerical stability
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(x => x / sum);
  }

  // Layer Normalization — stabilizes training, used before attention & FFN
  layerNorm(x, gamma, beta) {
    // x: [seq_len, nEmb] — one row per token
    return x.map(row => {
      const mean = row.reduce((a, b) => a + b, 0) / row.length;
      const variance = row.reduce((a, b) => a + (b - mean)**2, 0) / row.length;
      const std = Math.sqrt(variance + 1e-6);

      // Normalize, then apply learned scale (gamma) and shift (beta)
      return row.map((v, j) => gamma[j] * (v - mean) / std + beta[j]);
    });
  }

  // Single-head scaled dot-product attention
  // Multi-head is achieved by splitting embeddings into `nHead` chunks
  attention(x, block) {
    const q = this.matmul(x, block.q);  // [seq, emb]
    const k = this.matmul(x, block.k);
    const v = this.matmul(x, block.v);

    // Q @ Kᵀ → attention scores
    let scores = this.matmul(q, this.transpose(k));
    // Scale by √d_k (stabilizes gradients)
    scores = scores.map(row => row.map(val => val / Math.sqrt(this.headSize)));
    // Apply softmax → attention weights
    const weights = scores.map(row => this.softmax(row));
    // Weighted sum of values
    return this.matmul(weights, v); // [seq, emb]
  }

  // ==============================================================
  // FORWARD PASS — The heart of the model
  // ==============================================================
  forward(tokens) {
    let seqLen = tokens.length;
    if (seqLen === 0) return [];

    // 1. Embedding lookup + positional encoding
    let x = tokens.map((tok, i) => {
      const tokenVec = this.tokenEmb[tok] || this.zeros1D(this.nEmb);
      const posVec   = this.posEmb[i % this.blockSize]; // repeat if longer
      return tokenVec.map((v, j) => v + posVec[j]);
    });

    // 2. Pass through each transformer block
    for (const b of this.blocks) {
      // ——— Attention Branch ———
      const attnInput = this.layerNorm(x, b.ln1_w, b.ln1_b);
      const attnOut   = this.attention(attnInput, b);
      const projected = this.matmul(attnOut, b.proj);
      // Residual connection (very important!)
      x = x.map((row, i) => row.map((v, j) => v + projected[i][j]));

      // ——— Feed-Forward Branch ———
      const ffnInput = this.layerNorm(x, b.ln2_w, b.ln2_b);
      let hidden = this.matmul(ffnInput, b.ff1);           // expand 4×
      hidden = hidden.map(row => row.map(Math.tanh));       // non-linearity
      const ffnOut = this.matmul(hidden, b.ff2);           // back to nEmb
      // Another residual connection
      x = x.map((row, i) => row.map((v, j) => v + ffnOut[i][j]));
    }

    // 3. Final LayerNorm
    x = this.layerNorm(x, this.ln_f_w, this.ln_f_b);

    // 4. Project to vocabulary → logits for next token
    const logits = this.matmul(x, this.lmHead); // [seq, vocabSize]
    return logits;
  }

  // ==============================================================
  // TEXT GENERATION (Autoregressive sampling)
  // ==============================================================
  generate(promptTokens = [], maxNewTokens = 100) {
    let tokens = [...promptTokens];

    for (let step = 0; step < maxNewTokens; step++) {
      // Only look at last `blockSize` tokens (causal context)
      const context = tokens.slice(-this.blockSize);
      const logits = this.forward(context);

      if (logits.length === 0) break;

      // Get logits for the very last token
      const lastLogits = logits[logits.length - 1]; // 1D array [vocabSize]
      const probs = this.softmax(lastLogits);

      // Sample next token (you can also use top-k, nucleus, etc.)
      const nextToken = this.sample(probs);
      tokens.push(nextToken);
    }

    return tokens;
  }

  // Simple multinomial sampling
  sample(probs) {
    const r = Math.random();
    let cum = 0;
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (r < cum) return i;
    }
    return probs.length - 1; // fallback
  }
}

// ==============================================================
// SIMPLE CHARACTER-LEVEL TOKENIZER (for demo)
// ==============================================================
const vocab = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789.,!?\"'\n-:";
const charToId = Object.fromEntries([...vocab].map((c, i) => [c, i]));
const idToChar = [...vocab];

const tokenizer = {
  encode: (text) => [...text].map(c => charToId[c] ?? 0),
  decode: (ids)   => ids.map(i => idToChar[i] || '').join('')
};

// ==============================================================
// TEST IT!
// ==============================================================
const model = new TinyLLM({
  vocabSize: vocab.length,
  nEmb: 128,
  nHead: 8,
  nLayer: 6,
  blockSize: 128
});

const prompt = tokenizer.encode("Hello, how are you");
console.log("Prompt:", tokenizer.decode(prompt));

const outputIds = model.generate(prompt, 100);
console.log("\nGenerated:\n" + tokenizer.decode(outputIds));